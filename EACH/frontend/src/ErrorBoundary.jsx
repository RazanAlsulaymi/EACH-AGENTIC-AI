import { Component } from 'react'

export class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('App error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-50">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h1>
          <pre className="text-sm text-red-600 bg-red-50 p-4 rounded-lg overflow-auto max-w-2xl">
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg"
          >
            Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
