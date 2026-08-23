import Link from "next/link";

export function Footer() {
  return (
    <footer className="foot">
      <div className="wrap">
        <p>Strictlane is analysis, not betting advice.</p>
        <p>Made with ❤ for football by Markku Hihnala.</p>
        <ul>
          <li><Link href="/method">Method</Link></li>
          <li><Link href="/rounds">Rounds</Link></li>
          <li><Link href="/calibration">Calibration</Link></li>
        </ul>
      </div>
    </footer>
  );
}
