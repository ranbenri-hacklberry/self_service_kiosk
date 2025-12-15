import React from 'react';

const BackspaceIcon = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-6 h-6"
    {...props}
  >
    <path d="M3.5 12L9 6h10a2 2 0 012 2v8a2 2 0 01-2 2H9l-5.5-6z" />
    <path d="M12 9l4 4m0-4l-4 4" />
  </svg>
);

export default BackspaceIcon;
