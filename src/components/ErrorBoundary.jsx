import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error(error, info);
  }

  render() {
    if (this.state.hasError) {
      return <h1 className="text-red-600 text-center p-10">משהו השתבש... נסה לרענן.</h1>;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;