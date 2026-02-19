#!/usr/bin/env node
'use strict'

const fs   = require('fs')
const path = require('path')

// The Convex browser bundle (IIFE) — same file served by CDN
const src  = path.join(__dirname, '../node_modules/convex/dist/browser.bundle.js')
const dest = path.join(__dirname, 'convex-client.js')

if (!fs.existsSync(src)) {
  console.error('✗ Convex bundle not found. Run: npm install convex')
  process.exit(1)
}

fs.copyFileSync(src, dest)
console.log(`✓ Convex client copied → extension/convex-client.js (${(fs.statSync(dest).size / 1024).toFixed(0)} kB)`)
