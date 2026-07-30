export function Brand() {
  return (
    <header className="brand">
      {/* A plain <img> rather than next/image: the avatar is one fixed remote
          asset, and next/image would need an images.remotePatterns entry for
          avatars.githubusercontent.com to earn nothing here. */}
      <img
        className="brand-logo"
        src="https://avatars.githubusercontent.com/u/286363322?s=200&v=4"
        alt="Constructor Fabric"
        width={96}
        height={96}
      />
      <div className="brand-text">
        <h1>Constructor Fabric Pass</h1>
        <p className="brand-tagline">Welcome to the Constructor Fabric contributors community.</p>
      </div>
    </header>
  )
}
