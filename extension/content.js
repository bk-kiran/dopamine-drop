;(function () {
  'use strict'

  const SIDEBAR_ID    = 'dd-sidebar'
  const SIDEBAR_CLASS = 'dd-sidebar-container'

  // Canvas selectors for the native To Do list (tried in order)
  const TODO_SELECTORS = [
    '#right-side .to-do-list',
    '#right-side .todo-list-header',
    '#right-side .todo-sidebar',
    '#right-side [data-testid="todo-list"]',
  ]

  // ── Canvas user ID extraction ─────────────────────────────────────────────
  // Canvas exposes a global ENV object on every authenticated page.
  // We read ENV.current_user.id first, then fall back to parsing the DOM.

  function getCanvasUserId() {
    // Primary: Canvas's JS environment object
    try {
      const id = window.ENV?.current_user?.id
      if (id) return String(id)
    } catch (_) { /* ignore */ }

    // Fallback: profile link in the top nav (href="/users/12345")
    try {
      const profileAnchor =
        document.querySelector('a[href*="/profile"]') ||
        document.querySelector('#identity a') ||
        document.querySelector('.profile-link')
      if (profileAnchor) {
        const m = profileAnchor.href.match(/\/users\/(\d+)/)
        if (m) return m[1]
      }
    } catch (_) { /* ignore */ }

    return null
  }

  // ── Hide Canvas's native To Do list ──────────────────────────────────────

  function hideCanvasTodo() {
    for (const sel of TODO_SELECTORS) {
      const el = document.querySelector(sel)
      if (el) el.style.setProperty('display', 'none', 'important')
    }
  }

  // ── Inject the sidebar iframe into Canvas's #right-side ──────────────────

  function injectSidebar() {
    if (document.getElementById(SIDEBAR_ID)) return

    const rightSide = document.querySelector('#right-side')
    if (!rightSide) return   // Not a Canvas page that has the right sidebar

    // Hide native To Do before injecting ours
    hideCanvasTodo()

    // 1. Create our container
    const ddSidebar = document.createElement('div')
    ddSidebar.id        = SIDEBAR_ID
    ddSidebar.className = SIDEBAR_CLASS

    // 2. Create the iframe — extension pages are isolated, so this gives us
    //    a clean JS/CSS scope without leaking into Canvas's styles.
    const iframe = document.createElement('iframe')
    iframe.src   = chrome.runtime.getURL('sidebar.html')
    iframe.style.width  = '100%'
    iframe.style.height = '100vh'
    iframe.style.border = 'none'
    iframe.style.display = 'block'
    iframe.setAttribute('allowtransparency', 'true')
    iframe.title = 'dopamine drop sidebar'

    ddSidebar.appendChild(iframe)

    // 3. Prepend into Canvas's right-side panel (sits above Canvas's own content)
    rightSide.prepend(ddSidebar)

    // 4. Once the iframe has loaded, send the Canvas user ID via postMessage.
    //    Target origin is our extension URL so only our sidebar receives it.
    iframe.addEventListener('load', () => {
      const canvasUserId = getCanvasUserId()
      if (canvasUserId && iframe.contentWindow) {
        iframe.contentWindow.postMessage(
          { type: 'DD_CANVAS_USER_ID', canvasUserId },
          chrome.runtime.getURL('') // e.g. "chrome-extension://<id>/"
        )
      }
    })
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  function init() {
    // Only proceed if Canvas's right-sidebar container exists on this page
    if (!document.querySelector('#right-side')) return
    injectSidebar()
  }

  // Re-run on Canvas SPA navigation (debounced to avoid thrashing)
  let debounceTimer = null
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      hideCanvasTodo()
      if (!document.getElementById(SIDEBAR_ID)) injectSidebar()
    }, 400)
  })

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init()
      if (document.body) observer.observe(document.body, { childList: true, subtree: false })
    })
  } else {
    init()
    if (document.body) observer.observe(document.body, { childList: true, subtree: false })
  }
})()
