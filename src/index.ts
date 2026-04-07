import { setTimeout } from 'node:timers/promises';

import axios from 'axios';
import fs from 'fs-extra';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';

import { promiseResolver } from './utils.js';

type Quest = {
  version: string;
  type: string;
  name: string;
  status: 'Not Finished' | 'In Progress' | 'Finished';
  completionDate: Date | null;
  notes: string;
};

type QuestJSONExport = {
  exportDate: string;
  quests: Quest[];
  length: number;
};

interface IWutheringWavesQuestTracker {
  quests: Quest[];
  cache: Map<string, string>;
  fetchHTML: (url: string) => unknown;
  parseQuestsFromHTML: (html: string, version: string) => Quest[];
  // getMainQuestPrefix: (elem: cheerio.Cheerio<>) => {}
  // determineQuestType: (questType: string) => string;
  scrapeVersion: (version: string, urlPath: string) => Promise<number>;
  exportToJSON: () => void;
  scrapeAllVersions: () => void;
}

/* 
  Requirements:
    - Fetch HTML for each version page
      - Store each HTML with its page URL as key
    - Parse HTML and seek out the version's quest type and name
      - Store quest type and name along with other quest properties to the `quests` array
    - Create a JSON file according to the scrapped quest list
*/

const CONFIG = {
  wikiBaseUrl: 'https://wutheringwaves.fandom.com',
  versionPagesPaths: {
    '1.0': '/wiki/Version/1.0',
    // '1.1': '/wiki/Version/1.1',
    // '1.2': '/wiki/Version/1.2',
    // '1.3': '/wiki/Version/1.3',
    // '1.4': '/wiki/Version/1.4',
    // '2.0': '/wiki/Version/2.0',
    // '2.1': '/wiki/Version/2.1',
    // '2.2': '/wiki/Version/2.2',
    // '2.3': '/wiki/Version/2.3',
    // '2.4': '/wiki/Version/2.4',
    // '2.5': '/wiki/Version/2.5',
    // '2.6': '/wiki/Version/2.6',
    // '2.7': '/wiki/Version/2.7',
    // '2.8': '/wiki/Version/2.8',
    // '3.0': '/wiki/Version/3.0',
    // '3.1': '/wiki/Version/3.1',
    // '3.2': '/wiki/Version/3.2',
  },
  outputDir: './output',
  jsonFileName: `WuWa-Quests-${Date.now()}`,
};

const questTypeMapping = {
  Main_Quests: 'Main Quest',
  // Tutorial_Quests: 'Tutorial',
  // Companion_Stories: 'Companion',
  // Exploration_Quests: 'Exploration',
  // Side_Quests: 'Side Quests',
};

class WutheringWavesQuestTracker implements IWutheringWavesQuestTracker {
  quests: Quest[];
  cache: Map<string, string>;

  constructor() {
    this.quests = [];
    this.cache = new Map();
  }

  async fetchHTML(url: string) {
    if (this.cache.has(url)) {
      console.log(`Using cache: ${url}`);

      return this.cache.get(url) || '';
    }

    const result = await promiseResolver(
      axios.get<string>(url, {
        headers: {
          // 'User-Agent':
          //   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: 10000,
      }),
    );

    if (!result.success) {
      console.error(`Failed to fetch: ${url}`);

      throw result.error;
    }

    this.cache.set(url, result.data.data);

    return result.data.data;
  }

  parseQuestsFromHTML(html: string, version: string): Quest[] {
    const $ = cheerio.load(html);
    const quests = [];

    for (const [id, questTypeName] of Object.entries(questTypeMapping)) {
      const ul = $(`span#${id}`).parent().next();

      if (id === 'Main_Quests') {
        ul.children('li').each(function () {
          const nestedListItems = $(this).find('li');

          nestedListItems.each(function () {
            const quest = {
              version,
              type: questTypeName,
              name: $(this).text(),
              status: 'Not Finished',
              completionDate: null,
              notes: '',
            };
            console.log(
              '🚀 ~ WutheringWavesQuestTracker ~ parseQuestsFromHTML ~ quest:',
              quest,
            );
          });
        });
      }
    }

    return quests;
  }

  // determineQuestType(questType: string) {
  //   return 'Side Quest';
  // }

  async scrapeVersion(version: string, urlPath: string) {
    const url = `${CONFIG.wikiBaseUrl}${urlPath}`;

    console.log(`Launching browser for version: ${version}`);

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    try {
      // const html = await this.fetchHTML(url);

      /* ===================================================================== */

      const page = await browser.newPage();

      await page.setViewport({ width: 1366, height: 768 });
      await page.setUserAgent({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      console.log(`Navigating to URL: ${url}`);

      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });

      await setTimeout(3000);

      const html = await page.content();

      /* ===================================================================== */

      const versionQuests = await this.parseQuestsFromHTML(html, version);

      console.log(
        `Found ${versionQuests.length} quests for version ${version}.`,
      );

      this.quests.concat(versionQuests);

      return versionQuests.length;
    } catch (error) {
      console.error(`Scrape version error for version ${version}`);

      throw error;
    } finally {
      browser.close();
    }
  }

  exportToJSON() {}

  async scrapeAllVersions() {
    /* 
      1. Fetch all HTML pages and store it in cache
        - Add rate limiting per HTTP request (be nice to Fandom Wiki)
      2. Read all pages' HTML from cache, and scrape the quests
      3. Store quests found on each page to `quests` array
      4. Build an output object consisting of quests array and length
      5. Export output object as JSON and save it to designated output dir.
    */

    console.log('Start all version scrape.');

    try {
      for (const [version, urlPath] of Object.entries(
        CONFIG.versionPagesPaths,
      )) {
        const count = await this.scrapeVersion(version, urlPath);

        await this.sleep(Math.floor(Math.random() * 5 + 1) * 1000);
      }
    } catch (error) {
      console.error('Scrape all versions error.', error);
    }
  }

  sleep(ms: number) {
    return new Promise((resolve) => {
      setTimeout(ms).then(resolve);
    });
  }
}

async function main() {
  const scraper = new WutheringWavesQuestTracker();

  await scraper.scrapeAllVersions();
}

main().catch(console.log);
