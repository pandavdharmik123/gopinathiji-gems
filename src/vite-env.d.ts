/// <reference types="vite/client" />

declare module '@ai4bharat/indic-transliterate' {
  import * as React from 'react'

  export interface IndicTransliterateProps {
    value: string
    onChangeText: (text: string) => void
    lang: string
    renderComponent?: (props: any) => React.ReactNode
    [key: string]: any
  }

  export const IndicTransliterate: React.ComponentType<IndicTransliterateProps>
}
