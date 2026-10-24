import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PHOTO_PATH, cloudinaryThumb, ownOriginPhoto } from '../src/lib/photoUrl.js'

/**
 * PHOTOS ARE FETCHED FROM THE SITE'S OWN ORIGIN.
 *
 * Google Play's reviewer loaded the site and the API but never got an answer
 * from res.cloudinary.com, and refused the release over a catalogue of empty
 * boxes (24 October 2026). A photo is now asked for at `/photo/…` on the
 * site itself, and Vercel passes that on to Cloudinary. These hold the two
 * halves of that - the URL the app builds and the rewrite that serves it -
 * to each other, because either one changed alone is every photo gone.
 */
const master = 'https://res.cloudinary.com/wvd4cteq/image/upload/v1790059596/shanta-mahila-bazar/product/abc123.jpg'

test('a Cloudinary photo is asked for at this origin, with its transformation intact', () => {
  const thumb = cloudinaryThumb(master, 800)
  assert.equal(
    ownOriginPhoto(thumb),
    '/photo/wvd4cteq/f_auto,q_auto,c_fill,w_800,h_800/v1790059596/shanta-mahila-bazar/product/abc123.jpg',
  )
})

test('the cloud name travels in the path, so moving the photos to another account changes no config', () => {
  assert.equal(
    ownOriginPhoto('https://res.cloudinary.com/othercloud/image/upload/v1/x.jpg'),
    '/photo/othercloud/v1/x.jpg',
  )
})

test('anything that is not a Cloudinary delivery URL is left alone', () => {
  for (const url of ['/assets/pickles-abc.jpg', 'blob:https://example/1', 'https://example.com/a.jpg']) {
    assert.equal(ownOriginPhoto(url), url)
  }
})

test('the Vercel rewrite that serves /photo/ exists and comes before the SPA catch-all', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
    rewrites: { source: string; destination: string }[]
  }
  const [photo, ...rest] = config.rewrites
  assert.equal(photo.source, `${PHOTO_PATH}:cloud/:path*`)
  assert.equal(photo.destination, 'https://res.cloudinary.com/:cloud/image/upload/:path*')
  // Rewrites match in order: behind the catch-all, /photo/ would answer with index.html.
  assert.ok(rest.some((r) => r.destination === '/index.html'))
})
