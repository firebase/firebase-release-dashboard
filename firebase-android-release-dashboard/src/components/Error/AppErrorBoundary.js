import React from "react";
import PropTypes from "prop-types";
import {ErrorBoundary} from "react-error-boundary";
import ErrorFallback from "./ErrorFallback";

/**
 * AppErrorBoundary is a higher-order component that catches JavaScript errors
 * anywhere in their child component tree and displays a fallback UI.
 *
 * Errors that were not caught by any error boundary will result in unmounting
 * of the whole React component tree.
 *
 * @param {Object} props - The props to pass into the component.
 * @param {React.ReactNode} props.children - The child components to render.
 * @param {React.Component} [props.FallbackComponent=ErrorFallback] - The
 * component to render when an error occurs.
 * @return {JSX.Element} A boundary component that can catch and handle
 * errors from its child components.
 */
function AppErrorBoundary({children, FallbackComponent = ErrorFallback}) {
  return (
    <ErrorBoundary
      FallbackComponent={FallbackComponent}
      onReset={() => {
        // TODO: Reset or cleanup
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

AppErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  FallbackComponent: PropTypes.elementType,
};

export default AppErrorBoundary;
