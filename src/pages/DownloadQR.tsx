// GitHub Pages landing: one scannable QR that downloads the latest us!! APK from GitHub Releases.
import { QRCodeSVG } from 'qrcode.react';

/** https://<owner>.github.io/<repo>/ → https://github.com/<owner>/<repo>/releases/latest/download/us-app.apk */
export function apkUrl() {
  const env = import.meta.env.VITE_APK_URL as string | undefined;
  if (env) return env;
  const m = location.hostname.match(/^([^.]+)\.github\.io$/);
  const repo = location.pathname.split('/').filter(Boolean)[0];
  return m && repo ? `https://github.com/${m[1]}/${repo}/releases/latest/download/us-app.apk` : 'https://github.com/releases/latest/download/us-app.apk';
}

export default function DownloadQR() {
  const url = apkUrl();
  return (
    <div className="gate" style={{ overflowY: 'auto', touchAction: 'pan-y' }}>
      {[0, 1, 2, 3, 4].map((i) => <div key={i} className="cloud" style={{ top: `${10 + i * 18}%`, width: 200 + i * 40, height: 90, animationDelay: `${-i * 8}s` }} />)}
      <div className="glass card col center" style={{ zIndex: 2, maxWidth: 680, padding: 28, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 28, margin: 16 }}>
        <div className="col center" style={{ maxWidth: 300 }}>
          <div className="brand" style={{ fontSize: 56 }}>us!!</div>
          <div className="muted">Our tiny world. Scan with your phone camera to download the app.</div>
          <ol className="small" style={{ textAlign: 'left', lineHeight: 1.7, paddingLeft: 18 }}>
            <li>Scan the code and download <b>us-app.apk</b></li>
            <li>Open it and allow “install unknown apps” when Android asks</li>
            <li>Open <b>us!!</b>, enter our Partner Code, pick who you are</li>
          </ol>
          <a className="btn" href={url}>Download the APK</a>
        </div>
        <div style={{ background: '#FFF1F6', padding: 16, borderRadius: 22, boxShadow: '0 0 60px -10px #FF3E8A' }}>
          <QRCodeSVG value={url} size={230} fgColor="#170912" bgColor="#FFF1F6" level="M" />
        </div>
      </div>
    </div>
  );
}
