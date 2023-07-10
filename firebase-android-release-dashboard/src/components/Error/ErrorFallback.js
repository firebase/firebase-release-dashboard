import React from "react";
import PropTypes from "prop-types";
import {Button, Box, Typography} from "@material-ui/core";

/**
 * Fallback component that gets rendered when a component within the
 * ErrorBoundary throws an error.
 *
 * @param {Object} props - The props to pass into the component.
 * @param {Error} props.error - The error object that was thrown.
 * @param {Function} props.resetErrorBoundary - A function that can be called
 *  to reset the state of the error boundary.
 * @return {JSX.Element} The JSX to render.
 */
function ErrorFallback({error, resetErrorBoundary}) {
  return (
    <Box role="alert">
      <Typography variant="body1">Something went wrong:</Typography>
      <Box color="error.main" component="pre">{error.message}</Box>
      <Button
        variant="contained"
        color="primary"
        onClick={resetErrorBoundary}
      >
        Try again
      </Button>
    </Box>
  );
}

ErrorFallback.propTypes = {
  error: PropTypes.instanceOf(Error).isRequired,
  resetErrorBoundary: PropTypes.func.isRequired,
};

export default ErrorFallback;
