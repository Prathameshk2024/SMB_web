/**
 * WHERE A PHOTO IS FETCHED FROM.
 *
 * Every photo is stored as its Cloudinary URL, and until 24 October 2026 the
 * app asked Cloudinary for it directly. That day Google Play refused the first
 * production release for "incorrect placeholder content", with six screenshots
 * of the catalogue in which every product card was the beige box a card draws
 * under a photo that has not arrived. Names, prices and the category tiles
 * (bundled with the site) were all there; every Cloudinary photo was missing.
 * Nothing had errored, or the cards would have shown their category
 * photographs - on the reviewer's device res.cloudinary.com simply never
 * answered, while the site on Vercel and the API on Cloud Run did.
 *
 * So a photo is asked for at the site's OWN origin, `/photo/<cloud>/…`, which
 * `frontend/vercel.json` rewrites to Cloudinary (the Vite dev server proxies it
 * the same way): wherever the site loads, its photos load. The stored URL is
 * unchanged, so `ownImageProblem()` on the server still recognises it, and the
 * direct URL stays as the fallback for the day the rewrite is what is broken.
 */
export const PHOTO_PATH = '/photo/'

const CLOUDINARY = /^https:\/\/res\.cloudinary\.com\/([^/]+)\/image\/upload\/(.+)$/

/**
 * Ask Cloudinary for exactly the size we render, in whatever format the
 * browser prefers. Serving a 1200px master into a 150px card wastes most of
 * the bytes; `f_auto,q_auto` typically halves them again with WebP/AVIF.
 */
export function cloudinaryThumb(url: string, width: number): string {
  if (!url.includes('/image/upload/')) return url
  return url.replace(
    '/image/upload/',
    `/image/upload/f_auto,q_auto,c_fill,w_${width},h_${width}/`,
  )
}

/**
 * The same photo, at this site's origin. Anything that is not a Cloudinary
 * delivery URL - a bundled category photograph, a blob preview - is returned
 * as it is.
 */
export function ownOriginPhoto(url: string): string {
  const m = CLOUDINARY.exec(url)
  return m ? `${PHOTO_PATH}${m[1]}/${m[2]}` : url
}
