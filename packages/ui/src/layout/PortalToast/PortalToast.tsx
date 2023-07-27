import dynamic from 'next/dynamic'
import { Toaster, ToastBar, toast } from 'react-hot-toast'
import { Button, IconX } from 'ui'

const PortalRootWithNoSSR = dynamic(
  // @ts-ignore
  () => import('@radix-ui/react-portal').then((portal) => portal.Root),
  { ssr: false }
)

const PortalToast = () => (
  // @ts-ignore
  <PortalRootWithNoSSR className="portal--toast" id="toast">
    <Toaster
      position="top-right"
      toastOptions={{
        className: '!bg-scale-300 !text-scale-1200 border dark:border-dark !max-w-[600px]',
        style: {
          padding: '10px',
          fontSize: '0.875rem',
        },
        error: {
          duration: 8000,
        },
      }}
    >
      {(t) => (
        <ToastBar toast={t} style={t.style}>
          {({ icon, message }) => {
            const isConsentToast = t.id === 'consent-toast'
            return (
              <>
                {icon}
                <div className="flex items-center">
                  <div
                    className={`toast-message w-full ${
                      t.type === 'loading'
                        ? 'max-w-[380px]'
                        : isConsentToast
                        ? 'max-w-[800px]'
                        : 'max-w-[260px]'
                    }`}
                  >
                    {message}
                  </div>
                  {t.type !== 'loading' && !isConsentToast && (
                    <div className="ml-4">
                      <Button
                        className="!p-1"
                        type="text"
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          toast.dismiss(t.id)
                        }}
                      >
                        <IconX size={14} strokeWidth={2} />
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )
          }}
        </ToastBar>
      )}
    </Toaster>
  </PortalRootWithNoSSR>
)

export default PortalToast