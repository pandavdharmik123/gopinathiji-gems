import React from 'react'
import { IndicTransliterate } from '@ai4bharat/indic-transliterate'
import { Input, type InputProps } from 'antd'
import { useApp } from '../store/AppContext'
import { API_URL } from '../lib/api'

// Pre-populate sessionStorage to bypass the library's initial render fetch to xlit-api.ai4bharat.org/languages which is decommissioned.
if (typeof window !== 'undefined' && !sessionStorage.getItem("indic_transliterate__supported_languages")) {
  sessionStorage.setItem(
    "indic_transliterate__supported_languages",
    JSON.stringify([
      {
        LangCode: "gu",
        Direction: "ltr",
        GoogleFont: "Anek Gujarati",
        FallbackFont: "sans-serif"
      }
    ])
  );
}

interface TransliteratedInputProps extends Omit<InputProps, 'onChange'> {
  value?: string
  onChange?: (val: string) => void
  textArea?: boolean
  rows?: number
  enabled?: boolean
}

export default function TransliteratedInput({
  value = '',
  onChange,
  textArea = false,
  rows = 4,
  enabled = true,
  ...rest
}: TransliteratedInputProps) {
  return (
    <IndicTransliterate
      value={value}
      onChangeText={(val) => onChange?.(val)}
      lang="gu"
      enabled={enabled}
      customApiURL={`${API_URL}/transliterate/`}
      renderComponent={(props) => {
        // Extract properties and ref from IndicTransliterate wrapper
        const { ref, value: val, onChange: onValChange, ...componentProps } = props
        
        // Merge input props
        const mergedProps = { ...rest, ...componentProps }

        // Ant Design ref mapper to point ref.current directly to the underlying raw HTML input/textarea element
        const setRefs = (node: any) => {
          if (ref) {
            if (node) {
              ref.current = node.input || node.resizableTextArea?.textArea || node;
            } else {
              ref.current = null;
            }
          }
        };

        if (textArea) {
          return (
            <Input.TextArea
              {...mergedProps}
              ref={setRefs as any}
              rows={rows}
              value={val}
              onChange={(e) => {
                onValChange(e)
              }}
            />
          )
        }

        return (
          <Input
            {...mergedProps}
            ref={setRefs as any}
            value={val}
            onChange={(e) => {
              onValChange(e)
            }}
          />
        )
      }}
    />
  )
}
