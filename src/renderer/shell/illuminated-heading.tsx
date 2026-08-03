export function IlluminatedHeading(props: { title: string }) {
  const [initial = '', ...rest] = Array.from(props.title)

  return (
    <div className="illuminated" aria-label={props.title}>
      <span className="initial" aria-hidden="true">
        {initial}
      </span>
      <h2 aria-label={props.title}>{rest.join('')}</h2>
    </div>
  )
}
