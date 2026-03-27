import React, { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { ChakraProvider, defaultSystem } from '@chakra-ui/react'
import { createBrowserRouter, RouterProvider, useNavigate } from 'react-router-dom'
import { EditorPage } from './pages/EditorPage'
import { pluginRegistry } from './plugins/PluginRegistry'
import { LocalFilePlugin } from './plugins/LocalFilePlugin'
import { GCSPlugin } from './plugins/GCSPlugin'
import { GDrivePlugin } from './plugins/GDrivePlugin'
import { ChromeExtensionPlugin } from './plugins/ChromeExtensionPlugin'

// Register plugins
pluginRegistry.register(new LocalFilePlugin())
pluginRegistry.register(new GCSPlugin())
pluginRegistry.register(new GDrivePlugin())
pluginRegistry.register(new ChromeExtensionPlugin())

// Initialize all plugins
pluginRegistry.initializeAll().then(() => {
  console.log('All plugins initialized')
}).catch(error => {
  console.error('Plugin initialization error:', error)
})

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('Service Worker registered with scope:', registration.scope)
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error)
      })
  })
}

// PWA File Handling API
if ('launchQueue' in window && window.launchQueue) {
  console.log("PWA Launch Queue API is available")
  // This will be handled in the App component
}

/**
 * Component that redirects path-based URLs to canonical query string format
 * E.g., /gcs/bucket/prefix/file.lqaboss -> /?plugin=gcs&bucket=bucket&prefix=prefix&file=file.lqaboss
 */
const PathRedirect: React.FC = () => {
  const navigate = useNavigate()

  useEffect(() => {
    const pathSegments = window.location.pathname.split('/').filter(Boolean)

    if (pathSegments.length === 0) {
      // Already at root
      return
    }

    const pluginId = pathSegments[0]
    const plugin = pluginRegistry.getPlugin(pluginId)

    if (!plugin) {
      // Unknown plugin, redirect to root
      navigate('/', { replace: true })
      return
    }

    // Let plugin parse the path segments
    const fileIdentifier = plugin.parsePathUrl?.(pathSegments)

    if (!fileIdentifier) {
      // Plugin doesn't support path URLs or couldn't parse
      navigate('/', { replace: true })
      return
    }

    // Build canonical URL using the plugin
    const canonicalUrl = plugin.buildUrl?.(fileIdentifier) || '/'

    // If the canonical URL is a path (starts with /), convert to query string format
    if (canonicalUrl.startsWith('/') && canonicalUrl !== '/') {
      // The plugin returned a path URL, but we want query string format
      const queryParams = new URLSearchParams()
      queryParams.set('plugin', pluginId)

      // Add all identifier properties as query params
      Object.entries(fileIdentifier).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.set(key, String(value))
        }
      })

      const targetUrl = `/?${queryParams.toString()}`
      navigate(targetUrl, { replace: true })
    } else {
      navigate(canonicalUrl, { replace: true })
    }
  }, [navigate])

  // Show loading while redirecting
  return <div>Redirecting...</div>
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <EditorPage />,
  },
  {
    path: "/:plugin/*",
    element: <PathRedirect />,
  },
], {
  basename: "/"
})

const root = createRoot(document.getElementById('root')!)
root.render(
  <React.StrictMode>
    <ChakraProvider value={defaultSystem}>
      <RouterProvider router={router} />
    </ChakraProvider>
  </React.StrictMode>
) 