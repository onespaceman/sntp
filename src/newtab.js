"use strict"

const storage = {
  get: (key) => JSON.parse(localStorage.getItem(key)),
  set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
}

const layout = [["unfiled_____.contents"], ["toolbar_____.contents"]]
// folders by id to hide
const hidden = ["menu________", "mobile______"]

// Save folder open state
let openFolders = storage.get("openFolders") || []
function toggleFolder(id) {
  const i = openFolders.indexOf(id)
  if (i === -1) {
    openFolders.push(id)
  } else {
    openFolders.splice(i, 1)
  }
  storage.set("openFolders", openFolders)
}

async function load() {
  const bk = await browser.bookmarks.getTree()
  const tree = bk[0].children
  const main = document.getElementById("main")

  // Column 1
  const column1 = document.createElement("div")
  column1.classList.add("column")
  for (const i of tree[2].children) {
    const item = renderItem(i)
    item && column1.append(item)
  }

  const column2 = document.createElement("div")
  column2.classList.add("column")
  for (const i of tree[1].children) {
    const item = renderItem(i)
    item && column2.append(item)
  }

  const column3 = document.createElement("div")
  column3.classList.add("column")
  const closed = await renderRecentTabs()
  column3.append(closed)

  main.append(column1, column2, column3)

  if (browser.sessions) {
    browser.sessions.onChanged.addListener(refreshRecentTabs)
  }

  browser.menus.create({
    id: "open-all-links",
    title: "Open all links in folder",
    documentUrlPatterns: [location.origin + "/*"],
    contexts: ["page"],
  })

  browser.menus.onClicked.addListener(async (info) => {
    if (info.menuItemId === "open-all-links") {
      const folder = browser.menus.getTargetElement(info.targetElementId)
      if (folder && folder.dataset.id) {
        const children = await browser.bookmarks.getChildren(folder.dataset.id)
        const currentTab = await chrome.tabs.getCurrent()
        for (const n of children) {
          n.url && browser.tabs.create({ url: n.url, active: false, openerTabId: currentTab.id })
        }
      }
    }
  })
}

function renderItem(item) {
  if (item.type == "folder") {
    const details = document.createElement("details")
    const summary = document.createElement("summary")
    details.append(summary)
    summary.onclick = () => toggleFolder(item.id)
    summary.addEventListener("contextmenu", () => {
      browser.menus.overrideContext({
        showDefaults: false,
      })
    })
    summary.dataset.id = item.id
    summary.innerText = item.title
    if (openFolders.indexOf(item.id) > -1) {
      details.open = true
    }
    for (const i of item.children) {
      details.append(renderItem(i))
    }
    return details
    // Render a bookmark
  } else if (item.type == "bookmark") {
    const a = document.createElement("a")
    a.href = item.url
    a.innerText = item.title
    return a
    // Render a recently closed tab
  } else if (item.tab || item.window) {
    const a = document.createElement("a")
    a.innerText = item.tab ? item.tab.title : item.window.tabs.length + " Tabs"
    a.href = item.tab ? item.tab.url : null
    a.onclick = (e) => {
      e.preventDefault()
      browser.sessions.restore(item.window ? item.window.sessionId : item.tab.sessionId)
      refreshRecentTabs()
    }
    return a
  }
}

async function refreshRecentTabs() {
  const closed = document.getElementById("recentlyClosed")
  const newClosed = await renderRecentTabs()
  closed.replaceWith(newClosed)
}

async function renderRecentTabs() {
  const closedRaw = await browser.sessions.getRecentlyClosed()
  const closed = closedRaw.reduce((filtered, el) => {
    if (filtered.length > 9) return filtered
    if (el.window && el.window.tabs.length == 1) {
      el.tab = el.window.tabs[0]
    }
    if (!el.tab || (el.tab.url && !el.tab.url.startsWith(location.origin))) {
      filtered.push(el)
    }
    return filtered
  }, [])
  const closedItem = renderItem({
    id: "recentlyClosed________",
    title: "Recently Closed",
    children: closed,
    type: "folder",
  })
  closedItem.id = "recentlyClosed"
  return closedItem
}

load()
