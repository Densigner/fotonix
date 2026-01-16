import React, { Suspense } from "react";
import { Dialog, DialogContent } from "../../../shared/ui/dialog";
import { Button } from "../../../shared/ui/button";
import { Loader2, Check, X } from "lucide-react";

/**
 * TemplateViewer
 * - Opens a fullscreen preview modal for any template
 * - Supports both direct component rendering and iframe mode
 *
 * Props:
 *  open: boolean
 *  onClose: () => void
 *  onUse: (templateId: string) => void
 *  template: { id, name, desc, componentPath, image? }
 *  mode: "component" | "iframe" (default = "component")
 */
export default function TemplateViewer({
  open,
  onClose,
  onUse,
  template,
  mode = "component",
}) {
  const [PreviewComponent, setPreviewComponent] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (mode === "component" && template?.componentPath) {
      setLoading(true);
      import(`./${template.componentPath}`)
        .then((mod) => setPreviewComponent(() => mod.default))
        .catch((err) => console.error("Failed to load preview:", err))
        .finally(() => setLoading(false));
    }
  }, [template, mode]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-6xl h-[90vh] bg-white p-0 rounded-2xl overflow-hidden relative">
        {/* Toolbar */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between bg-white/80 backdrop-blur border-b px-6 py-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {template?.name}
            </h2>
            <p className="text-sm text-gray-500">{template?.desc}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => onUse?.(template.id)}
            >
              <Check className="h-4 w-4 mr-2" />
              Use this Template
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-white text-black border border-gray-200 hover:bg-gray-50"
              onClick={onClose}
            >
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
          </div>
        </div>

        {/* Viewer Area */}
        <div className="absolute inset-0 pt-[60px] bg-gray-50 overflow-auto">
          {loading && (
            <div className="flex items-center justify-center h-full text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading preview...
            </div>
          )}

          {!loading && mode === "component" && PreviewComponent && (
            <div className="min-h-full bg-white">
              <Suspense fallback={<div className="p-6">Loading preview...</div>}>
                <PreviewComponent />
              </Suspense>
            </div>
          )}

          {!loading && mode === "iframe" && template?.componentPath && (
            <iframe
              src={`/templates/${template.componentPath}.html`}
              title={template.name}
              className="w-full h-full border-0"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
