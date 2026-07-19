import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import 'antd/dist/reset.css'
import App from './App'
import './index.css'

// Intercept and silence verbose library logs from @ai4bharat/indic-transliterate
if (typeof window !== 'undefined') {
  const originalLog = console.log;
  console.log = (...args: any[]) => {
    if (args[0] === 'library data') {
      return;
    }
    originalLog(...args);
  };

  // Intercept fetch requests for transliterating to apply debouncing and local caches
  let debounceTimeout: any = null;
  let activeResolve: any = null;

  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    if (typeof input === 'string' && input.includes('/api/transliterate/gu/')) {
      const urlParts = input.split('/api/transliterate/gu/');
      const text = decodeURIComponent(urlParts[1] || '');

      // If the query text already contains Gujarati characters, return it locally immediately
      if (/[\u0A80-\u0AFF]/.test(text)) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              result: [text],
              output: [{ target: [text] }]
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            }
          )
        );
      }

      // Cancel the previous pending debounced fetch by resolving it with empty suggestions
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      if (activeResolve) {
        activeResolve(
          new Response(
            JSON.stringify({
              result: [],
              output: [{ target: [] }]
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            }
          )
        );
        activeResolve = null;
      }

      return new Promise<Response>((resolve, reject) => {
        activeResolve = resolve;
        debounceTimeout = setTimeout(() => {
          originalFetch.call(this, input, init)
            .then((res) => {
              if (activeResolve === resolve) {
                resolve(res);
                activeResolve = null;
              }
            })
            .catch((err) => {
              if (activeResolve === resolve) {
                reject(err);
                activeResolve = null;
              }
            });
        }, 180); // 180ms debounce filters out rapid typing queries completely
      });
    }
    return originalFetch.call(this, input, init);
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#2563EB',
          colorInfo: '#0284C7',
          colorSuccess: '#16A34A',
          colorWarning: '#D97706',
          colorError: '#DC2626',
          colorText: '#111827',
          colorTextSecondary: '#6B7280',
          colorBgLayout: '#F8FAFC',
          colorBgContainer: '#FFFFFF',
          colorBorder: '#E5E7EB',
          borderRadius: 10,
          fontFamily: 'Inter, "Noto Sans Gujarati", sans-serif',
          boxShadowSecondary: '0 8px 24px rgba(15, 23, 42, 0.06)',
        },
        components: {
          Button: {
            controlHeight: 38,
            primaryShadow: 'none',
          },
          Card: {
            borderRadiusLG: 12,
          },
          Table: {
            headerBg: '#F8FAFC',
            headerColor: '#111827',
            rowHoverBg: '#EFF6FF',
          },
          Menu: {
            itemSelectedBg: '#DBEAFE',
            itemSelectedColor: '#2563EB',
            itemHoverBg: '#EFF6FF',
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>,
)
