export function AccessibleTruncatedText(props: {
  value: string
  className?: string
}) {
  return (
    <span
      className={props.className}
      aria-label={props.value}
      title={props.value}
      tabIndex={0}
    >
      {props.value}
    </span>
  )
}
