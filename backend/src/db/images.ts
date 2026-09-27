/**
 * IS THIS AN IMAGE WE SIGNED AN UPLOAD FOR, OR JUST ANY LINK?
 *
 * Every photo in the app is stored as a URL, and until now the routes took
 * whatever URL they were sent: a seller's `photo`, her bank's QR image, a
 * product picture. All three reach buyers - the QR on the checkout screen
 * of every one of her orders - and a URL is a URL: somebody else's QR on an
 * image host, a picture that is not a picture, a link that tracks who opens
 * it. Only an image in THIS Cloudinary account, in the folder
 * `/uploads/signature` signs for, can have come through the app's own
 * picker, and that is the only kind accepted.
 *
 * `payment` and `product` are the two folders the signature route knows.
 * QR images and everything else that is not a payment screenshot go to
 * `product/`, so that is the folder a shop photo has to be in.
 */

export type ImageKind = 'product' | 'payment'

export interface CloudinaryHome {
  cloudName: string
  folder: string
}

/**
 * Null when the URL is ours, or absent. Absent is always fine here: no
 * screen requires a photo through this check, and the one that does
 * (`screenshotProblem`) says so itself.
 *
 * With uploads switched off nothing can have been uploaded, so any URL at
 * all is a pasted one and is refused.
 */
export function ownImageProblem(
  url: unknown,
  cloudinary: CloudinaryHome | null,
  kind: ImageKind,
): string | null {
  if (url === undefined || url === null || url === '') return null
  if (typeof url !== 'string') return 'फोटो पुन्हा जोडा'
  if (!cloudinary) return 'फोटो अपलोड सध्या बंद आहे'
  const ours = `https://res.cloudinary.com/${cloudinary.cloudName}/image/upload/`
  if (!url.startsWith(ours) || !url.includes(`/${cloudinary.folder}/${kind}/`)) {
    return 'फोटो पुन्हा जोडा'
  }
  return null
}
