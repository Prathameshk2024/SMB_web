import { useT } from '../../i18n/I18nProvider.js'

/**
 * The college this project is run under.
 *
 * No photograph. There was a slot for `frontend/public/college.jpg`, but the
 * file was never added, so every visit to the landing page asked for it and
 * got a 404 before falling back to this. The name and address are the part
 * that has to be right; a photo can come back as an imported asset once there
 * is a real one to import.
 *
 * Both languages are shown at once, not switched: the Marathi line is what a
 * villager reads and the English line is what goes into a form or a search, so
 * neither is a translation of the other that could be hidden.
 */
export default function CollegeCard() {
  const t = useT()

  return (
    <div className="college college--noimg">

      <div className="college__body">
        <p className="college__mr" lang="mr">{t('lp.collegeMr')}</p>
        <p className="college__en" lang="en">{t('lp.collegeEn')}</p>
      </div>
    </div>
  )
}
