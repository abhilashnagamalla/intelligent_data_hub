export default function BackgroundFrame({
  imageSrc,
  children,
  className = '',
  contentClassName = '',
  overlayClassName = '',
}) {
  const rootClassName = ['relative overflow-hidden rounded-3xl', className].filter(Boolean).join(' ');
  const innerClassName = ['relative z-10', contentClassName].filter(Boolean).join(' ');
  const imageOverlayClassName = [
    'absolute inset-0 bg-white/32 dark:bg-slate-950/58',
    overlayClassName,
  ].filter(Boolean).join(' ');

  return (
    <div className={rootClassName}>
      <div className="absolute inset-0">
        <img
          src={imageSrc}
          alt=""
          className="h-full w-full object-cover object-center"
        />
        <div className={imageOverlayClassName} />
      </div>

      <div className={innerClassName}>
        {children}
      </div>
    </div>
  );
}
