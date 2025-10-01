import fs from 'fs'
import * as cheerio from 'cheerio'

const useCache = true

type Article = {
  id: string
  title: string
  datetime: string
  content: string
  href: string
  magent: string | null
}

const getTimestamp = (): number => {
  // 精确度取每小时
  const startOfHour = new Date()
  startOfHour.setMinutes(0, 0, 0)
  return startOfHour.valueOf()
}

const isValidArticle = (article: any): article is Article => {
  if (article.title && article.datetime) {
    // 如果title或datetime为空，说明是广告
    return true
  } else {
    return false
  }
}

const fetchArticle = async (article: Article) => {
  if (useCache && fs.existsSync(`./pages/${article.id}.html`)) {
    return fs.readFileSync(`./pages/${article.id}.html`, 'utf-8')
  }

  const res = await fetch(article.href)
  const html = await res.text()

  if (useCache) {
    fs.writeFileSync(`./pages/${article.id}.html`, html, 'utf-8')
  }
  return html
}

const processArticle = async (article: Article) => {
  const html = await fetchArticle(article)
  const $ = cheerio.load(html)
  const content = $('div.entry-content').html()
  if (content) {
    const matched = content.match(/([0-9a-fA-F]{40})/)
    if (matched) {
      article.magent = `magnet:?xt=urn:btih:${matched[0]}`
      fs.writeFileSync(`./collections/${article.title}.json`, JSON.stringify(article, null, 4))
    }
  }
}

const fetchPage = async (page: number = 1): Promise<string> => {
  if (useCache && fs.existsSync(`./pages/${getTimestamp()}-${page}.html`)) {
    return fs.readFileSync(`./pages/${getTimestamp()}-${page}.html`, 'utf-8')
  }

  const res = await fetch(`https://www.hacg.mov/wp/anime.html/page/${page}`)
  const html = await res.text()

  if (useCache) {
    fs.writeFileSync(`./pages/${getTimestamp()}-${page}.html`, html, 'utf-8')
  }
  return html
}

const parsePage = async (html: string) => {
  const $ = cheerio.load(html)
  await Promise.all($('article').map(async (_, el) => {
    const $article = $(el)
    const article = {
      id: $article.attr('id'),
      title: $article.find('.entry-title').text(),
      datetime: $article.find('.entry-date').attr('datetime'),
      content: $article.find('div.entry-content p').text().replace(/继续阅读 →$/, '').trim(),
      href: $article.find('.entry-title a').attr('href'),
    }
    if (isValidArticle(article)) {
      if (article.title.match(/\d{4}年\d+月动画合集/)) {
        await processArticle(article)
      }
    }
  }))
}

await Promise.all(
  Array
    .from({ length: 3 }, (_, index) => index + 1)
    .map(async (i) => {
      const html = await fetchPage(i)
      await parsePage(html)
    }))
