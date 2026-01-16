import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, LayoutTemplate, ArrowLeft, Eye, Check, Loader2 } from "lucide-react";
import lawFirmCard from "./cardviewlaw.png";
import empowerWomanCard from "./empowerwoman.png";
import becomeAVol from "./becomeavol.png";
import wildlifeImg from "./wildlifeimg.png";
import customImg from "./customimgtemp.png";
import { Button } from "../../../shared/ui/button";
import { Card, CardContent } from "../../../shared/ui/card";
import TemplateViewer from "./TemplateViewer";
import { Separator } from "../../../shared/ui/separator";
import { Badge } from "../../../shared/ui/badge";

const templates = [
  {
    id: "lawfirm",
    name: "Law Firm Landing",
    desc: "Elegant layout tailored for legal professionals.",
    category: "Business",
  image: lawFirmCard,
    componentPath: "LawFirmLanding",
  },
  {
    id: "volunteer",
    name: "Volunteer Page",
    desc: "Inspire community participation with a strong CTA.",
    category: "Non-Profit",
    image: becomeAVol,
    componentPath: "VolunteerTemplate",
  },
  {
    id: "wildlife",
    name: "Wildlife Conservation",
    desc: "Showcase conservation efforts with immersive visuals.",
    category: "Environment",
    image: wildlifeImg,
    componentPath: "WildlifeConservationPage",
  },
  {
    id: "blank",
    name: "Custom Blank",
    desc: "Start from scratch with an empty canvas.",
    category: "Custom",
    image: customImg,
    componentPath: "BlankTemplate",
  },
  {
    id: "women",
    name: "Women Empowerment",
    desc: "Empower your audience with a powerful advocacy layout.",
    category: "Advocacy",
    image: empowerWomanCard,
    componentPath: "WomenEmpowermentPage",
  },
];

export default function TemplatesPage({ onSelectTemplate }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const navigate = useNavigate();

  const filtered = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase())
  );

  const handlePreview = async (tmpl) => {
    // Open the centralized TemplateViewer which will dynamically load the component
    setSelected(tmpl);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-indigo-50/60 to-purple-50/60">
      {/* Top Nav */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-14 px-6">
          <div className="flex items-center gap-2 text-gray-800 font-semibold">
            <LayoutTemplate className="h-5 w-5 text-indigo-600" />
            <span className="text-sm md:text-base tracking-tight">Choose a Funnel Template</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-2"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="h-4 w-4" /> Back to Builder
          </Button>
        </div>
      </header>

      {/* Search Bar */}
      <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center w-full sm:w-80 border border-gray-200 bg-white rounded-xl px-3 py-2 shadow-sm">
          <Search className="h-4 w-4 text-gray-500 mr-2" />
          <input
            type="text"
            placeholder="Search templates..."
            className="w-full text-sm outline-none bg-transparent"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="hidden sm:block text-xs text-gray-500">
          {filtered.length} templates available
        </div>
      </div>

      <Separator className="mb-4" />

      {/* Template Grid */}
      <main className="max-w-7xl mx-auto px-6 pb-20">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map((tmpl) => (
            <motion.div
              key={tmpl.id}
              whileHover={{ y: -4 }}
              transition={{ type: "spring", stiffness: 250 }}
            >
              <Card
                className="group relative border border-gray-200 hover:shadow-lg transition-all duration-200 cursor-pointer"
                onClick={() => setSelected(tmpl)}
              >
                <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden rounded-t-lg">
                  {/* Image */}
                  <img
                    src={tmpl.image}
                    alt={tmpl.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />

                  {/* Bottom buttons (inside card, non-overlay) */}
                  <div className="absolute left-0 right-0 bottom-0 p-3 flex items-center justify-center gap-3">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-32 shadow-md hover:bg-slate-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreview(tmpl);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" /> Preview
                    </Button>

                    <Button
                      size="sm"
                      className="w-32 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectTemplate) {
                          onSelectTemplate(tmpl.id);
                        } else {
                          navigate(`/funnel-builder?template=${tmpl.id}`);
                        }
                      }}
                    >
                      <Check className="h-4 w-4 mr-2" /> Use
                    </Button>
                  </div>
                </div>

                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{tmpl.name}</h3>
                    <Badge className="bg-gray-100 text-gray-600">{tmpl.category}</Badge>
                  </div>
                  <p className="text-sm text-gray-600 leading-snug line-clamp-2">{tmpl.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center text-gray-500 py-20">
            No templates found for “{search}”.
          </div>
        )}
      </main>

      {/* Template Preview Viewer (centralized) */}
      <TemplateViewer
        open={!!selected}
        onClose={() => setSelected(null)}
        onUse={(id) => {
          if (onSelectTemplate) onSelectTemplate(id);
          else navigate(`/funnel-builder?template=${id}`);
          setSelected(null);
        }}
        template={selected}
        mode="component"
      />
    </div>
  );
}
