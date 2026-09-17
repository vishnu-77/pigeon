import { PigeonSite } from "@/components/PigeonSite";

type GithubRelease = {
  tag_name: string;
  html_url: string;
};

async function getLatestRelease(): Promise<GithubRelease | null> {
  try {
    const response = await fetch("https://api.github.com/repos/vishnu-77/pigeon/releases/latest", {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "pigeonmq-website",
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) return null;
    return (await response.json()) as GithubRelease;
  } catch {
    return null;
  }
}

export default async function Home() {
  const release = await getLatestRelease();

  return (
    <>
      {release && (
        <a
          href={release.html_url}
          target="_blank"
          rel="noreferrer"
          className="release-bar"
          aria-label={`View PigeonMQ ${release.tag_name} release on GitHub`}
        >
          <span className="release-bar__label">Latest release</span>
          <span className="release-bar__version">{release.tag_name}</span>
          <span className="release-bar__arrow" aria-hidden="true">↗</span>
        </a>
      )}
      <PigeonSite />
    </>
  );
}
