import { Alert, Center, Loader } from '@mantine/core';

export function Loading() {
  return <Center py="xl"><Loader /></Center>;
}

export function ErrorAlert({ error, title = 'Something went wrong' }) {
  if (!error) return null;
  return (
    <Alert color="red" title={title}>
      {error.message || String(error)}
    </Alert>
  );
}
