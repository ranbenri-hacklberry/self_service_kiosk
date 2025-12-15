import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Log error in development only
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      const { fallback: Fallback, showDetails = false } = this.props;

      if (Fallback) {
        return <Fallback error={this.state.error} retry={this.handleRetry} />;
      }

      return (
        <div className="min-h-[300px] flex items-center justify-center bg-red-50 border border-red-200 rounded-lg p-6 m-4">
          <div className="text-center max-w-md">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h3 className="text-xl font-semibold text-red-800 mb-3">
              משהו השתבש בקומפוננטה זו
            </h3>
            <p className="text-red-600 mb-4 text-sm">
              האפליקציה ממשיכה לעבוד - רק רכיב זה נפגע ולא מציג תוכן
            </p>
            {showDetails && this.state.error && (
              <details className="mb-4 text-left bg-red-100 p-3 rounded text-xs">
                <summary className="cursor-pointer font-medium">פרטי השגיאה</summary>
                <pre className="mt-2 whitespace-pre-wrap text-red-700">
                  {this.state.error.toString()}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            <button
              onClick={this.handleRetry}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              נסה שוב
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;