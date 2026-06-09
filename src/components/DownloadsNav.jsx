import { Link, useLocation } from 'react-router-dom'
import { DOWNLOAD_TOOLS } from '../data/downloadTools'

export default function DownloadsNav() {
  const { pathname } = useLocation()

  const tab = (to, label) => {
    const active = pathname === to
    return (
      <Link
        key={to}
        to={to}
        className={'navbtn-link dl-tab' + (active ? ' dl-tab-active' : '')}
        aria-current={active ? 'page' : undefined}
      >
        {active ? '▶ ' : ''}{label}{active ? ' ◀' : ''}
      </Link>
    )
  }

  return (
    <center>
      <table width="100%" cellPadding="0" cellSpacing="0" border="0">
        <tbody>
          <tr>
            <td align="center" bgcolor="#FF00FF" className="section-bar-sm">
              <font face="Impact" size="4" color="#FFFF00">
                ~ DOWNLOAD TOOLS ~
              </font>
            </td>
          </tr>
        </tbody>
      </table>
      <br />
      <div className="dl-tabbar">
        {tab('/downloads', '★ ALL ★')}
        {DOWNLOAD_TOOLS.map((t) => tab(t.to, t.label))}
      </div>
      <br />
    </center>
  )
}
