// This site is intentionally written in 1998-flavored HTML (<font>, bgcolor…).
// Those elements/attributes predate React's TypeScript types, so .tsx pages
// need this augmentation; the .jsx pages are simply never type-checked.
import 'react'

declare module 'react' {
  interface TdHTMLAttributes<T> {
    bgcolor?: string
  }
  interface TableHTMLAttributes<T> {
    bgcolor?: string
  }

  namespace JSX {
    interface IntrinsicElements {
      font: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          face?: string
          size?: string | number
          color?: string
        },
        HTMLElement
      >
    }
  }
}
