type SpinnerProps = {
  className?: string;
};

export function Spinner({ className }: SpinnerProps) {
  return (
    <span
      className={[
        'inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent align-[-0.125em]',
        'animate-spin',
        className ?? '',
      ].join(' ')}
      aria-hidden="true"
    />
  );
}
