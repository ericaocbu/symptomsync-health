import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  FileText,
  FileImage,
  File,
  Upload,
  Download,
  Eye,
  Plus,
  Search,
  Tag,
  CalendarDays,
  HeartPulse,
  Edit3,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  X,
} from "lucide-react";

import Head from "next/head";
import { toast } from "sonner";

import { supabase } from "@/lib/supabaseClient";
import { fetchUserFiles, uploadUserFile } from "@/lib/files";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type FileRow = {
  id: string;
  filename: string;
  url: string;
  file_type: string;
  uploaded_at: string;
  tags?: string[];
};

const ITEMS_PER_PAGE = 50;

function getFileIcon(fileType: string) {
  if (fileType.startsWith("image/")) return FileImage;
  if (fileType === "application/pdf") return FileText;
  return File;
}

function getFileTypeLabel(fileType: string) {
  if (fileType === "application/pdf") return "PDF";

  if (fileType.startsWith("image/")) {
    return fileType.split("/")[1]?.toUpperCase() || "Image";
  }

  if (fileType.includes("word")) return "Word document";
  if (fileType.includes("spreadsheet")) return "Spreadsheet";

  return fileType.split("/").pop()?.replace(/[-_]/g, " ") || "File";
}

export default function DocumentsPage() {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [search, setSearch] = useState("");

  const [uploading, setUploading] = useState(false);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [customFilename, setCustomFilename] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const [loadingFiles, setLoadingFiles] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [healthDialogOpen, setHealthDialogOpen] = useState(false);
  const [selectedForReport, setSelectedForReport] = useState<string[]>([]);
  const [reportProcessing, setReportProcessing] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);

  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [confirmDeleteDialogOpen, setConfirmDeleteDialogOpen] =
    useState(false);
  const [deleting, setDeleting] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<FileRow | null>(null);
  const [editFilename, setEditFilename] = useState("");
  const [editTagsInput, setEditTagsInput] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const { refetch } = useQuery({
    queryKey: ["files", currentPage],
    queryFn: fetchFiles,
  });

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function subscribeToUserChannel() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!user) {
        router.push("/auth/login");
        return;
      }

      channel = supabase.channel(`user-channel-${user.id}`, {
        config: { broadcast: { self: false } },
      });

      channel
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .on("broadcast", { event: "*" }, (payload: any) => {
          const message = payload?.payload?.message;

          if (message) {
            toast.success(
              `${message.replace(/\./g, "")} from another device or tab.`,
            );
          }
        })
        .subscribe();
    }

    void subscribeToUserChannel();

    return () => {
      cancelled = true;

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [router]);

  async function fetchFiles() {
    setLoadingFiles(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Please log in to view your documents.");
        router.push("/auth/login");
        return true;
      }

      const docs = await fetchUserFiles(user.id, currentPage);
      setFiles(docs);

      const { count, error: countError } = await supabase
        .from("files")
        .select("id", { count: "exact", head: true })
        .eq("user_profile_id", user.id);

      if (countError) {
        console.error("Error fetching document count:", countError);
      } else {
        setTotalDocuments(count || 0);
      }

      return true;
    } catch (error) {
      console.error("Error fetching files:", error);
      toast.error("Failed to fetch your documents.");
      return false;
    } finally {
      setLoadingFiles(false);
    }
  }

  async function handleUpload() {
    if (!fileToUpload) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Please log in to upload a document.");
      return;
    }

    setUploading(true);

    try {
      let fileToProcess = fileToUpload;

      if (customFilename.trim()) {
        fileToProcess = new window.File(
          [fileToUpload],
          customFilename.trim(),
          {
            type: fileToUpload.type,
          },
        );
      }

      const tags = tagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      await uploadUserFile(fileToProcess, user.id, tags);

      toast.success("Document uploaded successfully.");

      setFileToUpload(null);
      setCustomFilename("");
      setTagsInput("");
      setDialogOpen(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await refetch();
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Failed to upload document.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(url: string, filename: string) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Unable to download file.");
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = blobUrl;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download document.");
    }
  }

  async function handleDownloadAll() {
    if (files.length === 0) return;

    try {
      for (const file of files) {
        await handleDownload(file.url, file.filename);
      }
    } catch (error) {
      console.error("Error downloading documents:", error);
      toast.error("Some documents could not be downloaded.");
    }
  }

  function openEditDialog(file: FileRow) {
    setEditingFile(file);
    setEditFilename(file.filename);
    setEditTagsInput(file.tags?.join(", ") || "");
    setEditDialogOpen(true);
  }

  async function handleSaveEdit() {
    if (!editingFile || !editFilename.trim()) {
      toast.error("Please enter a filename.");
      return;
    }

    const newTags = editTagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    setSavingEdit(true);

    try {
      const { error } = await supabase
        .from("files")
        .update({
          filename: editFilename.trim(),
          tags: newTags,
        })
        .eq("id", editingFile.id);

      if (error) throw error;

      setFiles((previous) =>
        previous.map((file) =>
          file.id === editingFile.id
            ? {
                ...file,
                filename: editFilename.trim(),
                tags: newTags,
              }
            : file,
        ),
      );

      toast.success("Document details updated.");
      setEditDialogOpen(false);
      setEditingFile(null);
    } catch (error) {
      console.error("Error updating document:", error);
      toast.error("Failed to update document details.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete() {
    if (!fileToDelete) return;

    setDeleting(true);

    try {
      const { error } = await supabase
        .from("files")
        .delete()
        .eq("id", fileToDelete);

      if (error) throw error;

      toast.success("Document deleted successfully.");

      setFiles((previous) =>
        previous.filter((file) => file.id !== fileToDelete),
      );

      setTotalDocuments((previous) => Math.max(0, previous - 1));
      setConfirmDeleteDialogOpen(false);
      setFileToDelete(null);

      await refetch();
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Failed to delete document.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleExportHealthReport() {
    if (selectedForReport.length === 0) {
      toast.error("Please select at least one document.");
      return;
    }

    setReportProcessing(true);

    try {
      const mergedPdf = await PDFDocument.create();
      const titlePage = mergedPdf.addPage();
      const { height } = titlePage.getSize();

      const font = await mergedPdf.embedFont(StandardFonts.HelveticaBold);

      titlePage.drawText("SymptomSync - Your Health Report", {
        x: 50,
        y: height - 4 * 24,
        size: 24,
        font,
        color: rgb(0.25, 0.37, 0.45),
      });

      titlePage.drawText(
        `Generated on ${format(new Date(), "MMMM d, yyyy")}`,
        {
          x: 50,
          y: height - 4 * 24 - 35,
          size: 11,
          font: await mergedPdf.embedFont(StandardFonts.Helvetica),
          color: rgb(0.4, 0.45, 0.48),
        },
      );

      for (const fileId of selectedForReport) {
        const file = files.find((item) => item.id === fileId);
        if (!file) continue;

        const extension = file.filename.split(".").pop()?.toLowerCase();

        const response = await fetch(file.url);

        if (!response.ok) {
          throw new Error(`Could not retrieve ${file.filename}`);
        }

        const arrayBuffer = await response.arrayBuffer();

        if (extension === "pdf") {
          const donorPdf = await PDFDocument.load(arrayBuffer);
          const pages = await mergedPdf.copyPages(
            donorPdf,
            donorPdf.getPageIndices(),
          );

          pages.forEach((page) => mergedPdf.addPage(page));
        } else if (["png", "jpg", "jpeg"].includes(extension || "")) {
          const image =
            extension === "png"
              ? await mergedPdf.embedPng(arrayBuffer)
              : await mergedPdf.embedJpg(arrayBuffer);

          const dimensions = image.scale(1);
          const imagePage = mergedPdf.addPage([
            dimensions.width,
            dimensions.height,
          ]);

          imagePage.drawImage(image, {
            x: 0,
            y: 0,
            width: dimensions.width,
            height: dimensions.height,
          });
        }
      }

      const pdfBytes = await mergedPdf.save();

      const pdfBlobData = new Uint8Array(pdfBytes.length);
      pdfBlobData.set(pdfBytes);

      const blob = new Blob([pdfBlobData.buffer], {
        type: "application/pdf",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "SymptomSync_Health_Report.pdf";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);

      setHealthDialogOpen(false);
      setSelectedForReport([]);

      toast.success("Health report exported successfully.");
    } catch (error) {
      console.error("Error creating health report:", error);
      toast.error("Failed to export health report.");
    } finally {
      setReportProcessing(false);
    }
  }

  const filteredFiles = files.filter((file) =>
    file.filename.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const startIndex =
    totalDocuments > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0;

  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, totalDocuments);

  const reportEligibleFiles = filteredFiles.filter(
    (file) =>
      file.file_type === "application/pdf" ||
      file.file_type.startsWith("image/"),
  );

  return (
    <>
      <Head>
        <title>SymptomSync | Your Documents</title>
        <meta
          name="description"
          content="View and manage your health documents."
        />
      </Head>

      <div className="min-h-screen bg-[#f7f8f8] text-[#27333b]">
        <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:py-10">
          {/* Page header */}
          <div className="mb-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e6edf2] text-[#405f73]">
                    <FolderOpen size={19} />
                  </div>
                  <span className="text-sm font-semibold tracking-wide text-[#587587]">
                    YOUR HEALTH RECORDS
                  </span>
                </div>

                <h1 className="text-3xl font-semibold tracking-tight text-[#27333b] sm:text-4xl">
                  Your documents
                </h1>

                <p className="mt-2 max-w-xl text-sm leading-6 text-[#69747b] sm:text-base">
                  Keep your health documents organized and accessible in one
                  place.
                </p>
              </div>

              <Button
                onClick={() => setDialogOpen(true)}
                className="h-11 rounded-full bg-[#405f73] px-5 text-white shadow-sm transition-colors hover:bg-[#324e60]"
              >
                <Plus size={17} className="mr-2" />
                Upload document
              </Button>
            </div>
          </div>

          {/* Overview and actions */}
          <section className="mb-6 rounded-2xl border border-[#e4e8e9] bg-white p-5 shadow-[0_2px_12px_rgba(39,51,59,0.03)] sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e6edf2] text-[#405f73]">
                  <FileText size={23} />
                </div>

                <div>
                  <p className="text-sm text-[#69747b]">
                    Documents in your library
                  </p>
                  <p className="mt-0.5 text-2xl font-semibold tabular-nums text-[#27333b]">
                    {totalDocuments}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={handleDownloadAll}
                  disabled={files.length === 0 || loadingFiles}
                  className="h-10 rounded-full border-[#dce3e6] bg-white px-4 text-[#405f73] hover:bg-[#f5f7f8] hover:text-[#324e60]"
                >
                  <Download size={16} className="mr-2" />
                  Download this page
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setHealthDialogOpen(true)}
                  disabled={reportEligibleFiles.length === 0}
                  className="h-10 rounded-full border-[#dce3e6] bg-white px-4 text-[#405f73] hover:bg-[#f5f7f8] hover:text-[#324e60]"
                >
                  <HeartPulse size={16} className="mr-2" />
                  Create health report
                </Button>
              </div>
            </div>
          </section>

          {/* Document library */}
          <section className="overflow-hidden rounded-2xl border border-[#e4e8e9] bg-white shadow-[0_2px_12px_rgba(39,51,59,0.03)]">
            <div className="flex flex-col gap-4 border-b border-[#edf0f1] p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h2 className="text-lg font-semibold text-[#27333b]">
                  Document library
                </h2>
                <p className="mt-1 text-sm text-[#69747b]">
                  Browse, view, and manage your uploaded files.
                </p>
              </div>

              <div className="relative w-full sm:max-w-xs">
                <Search
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#89949a]"
                />
                <Input
                  placeholder="Search documents..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-10 rounded-xl border-[#e4e8e9] bg-[#fafbfb] pl-10 pr-10 text-sm placeholder:text-[#9aa3a8] focus-visible:ring-[#718b9b]"
                />

                {search && (
                  <button
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#89949a] hover:text-[#405f73]"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* Column labels */}
            <div className="hidden grid-cols-[minmax(0,1fr)_140px_145px_130px] gap-4 border-b border-[#edf0f1] bg-[#fafbfb] px-6 py-3 text-xs font-semibold uppercase tracking-wide text-[#89949a] md:grid">
              <span>Document</span>
              <span>File type</span>
              <span>Date added</span>
              <span className="text-right">Actions</span>
            </div>

            <div>
              {loadingFiles ? (
                <div className="flex min-h-[250px] flex-col items-center justify-center gap-3">
                  <Loader2 className="h-7 w-7 animate-spin text-[#718b9b]" />
                  <p className="text-sm text-[#69747b]">
                    Loading your documents...
                  </p>
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="flex min-h-[300px] flex-col items-center justify-center px-6 py-12 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e6edf2] text-[#587587]">
                    {search ? (
                      <Search size={27} />
                    ) : (
                      <FolderOpen size={29} />
                    )}
                  </div>

                  <h3 className="text-lg font-semibold text-[#27333b]">
                    {search ? "No matching documents" : "Your library is empty"}
                  </h3>

                  <p className="mt-2 max-w-sm text-sm leading-6 text-[#69747b]">
                    {search
                      ? "Try a different search term or clear your search to see your documents."
                      : "Upload health records, test results, or other important files to keep everything organized."}
                  </p>

                  {search ? (
                    <Button
                      variant="outline"
                      onClick={() => setSearch("")}
                      className="mt-5 rounded-full border-[#dce3e6] text-[#405f73] hover:bg-[#f5f7f8]"
                    >
                      Clear search
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setDialogOpen(true)}
                      className="mt-5 rounded-full bg-[#405f73] px-5 text-white hover:bg-[#324e60]"
                    >
                      <Upload size={16} className="mr-2" />
                      Upload your first document
                    </Button>
                  )}
                </div>
              ) : (
                <div>
                  {filteredFiles.map((file) => {
                    const FileIcon = getFileIcon(file.file_type);

                    return (
                      <div
                        key={file.id}
                        className="group grid grid-cols-1 gap-4 border-b border-[#edf0f1] px-5 py-5 transition-colors last:border-b-0 hover:bg-[#fafbfb] sm:px-6 md:grid-cols-[minmax(0,1fr)_140px_145px_130px] md:items-center"
                      >
                        {/* File name and tags */}
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e6edf2] text-[#587587]">
                            <FileIcon size={20} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <button
                              onClick={() => router.push(`/files/${file.id}`)}
                              className="max-w-full truncate text-left text-sm font-semibold text-[#27333b] transition-colors hover:text-[#587587]"
                            >
                              {file.filename}
                            </button>

                            {file.tags && file.tags.length > 0 ? (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {file.tags.map((tag, index) => (
                                  <span
                                    key={`${tag}-${index}`}
                                    className="inline-flex items-center gap-1 rounded-full bg-[#f0f3f4] px-2.5 py-1 text-xs text-[#69747b]"
                                  >
                                    <Tag size={11} />
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-1 text-xs text-[#9aa3a8]">
                                No tags added
                              </p>
                            )}

                            <div className="mt-2 flex items-center gap-1.5 text-xs text-[#89949a] md:hidden">
                              <CalendarDays size={13} />
                              {format(
                                new Date(file.uploaded_at),
                                "MMM d, yyyy",
                              )}
                              <span className="mx-1">·</span>
                              {getFileTypeLabel(file.file_type)}
                            </div>
                          </div>
                        </div>

                        {/* File type */}
                        <div className="hidden md:block">
                          <span className="inline-flex rounded-full bg-[#f0f3f4] px-3 py-1.5 text-xs font-medium text-[#69747b]">
                            {getFileTypeLabel(file.file_type)}
                          </span>
                        </div>

                        {/* Date */}
                        <div className="hidden items-center gap-2 text-sm text-[#69747b] md:flex">
                          <CalendarDays
                            size={15}
                            className="shrink-0 text-[#89949a]"
                          />
                          {format(
                            new Date(file.uploaded_at),
                            "MMM d, yyyy",
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-1 border-t border-[#edf0f1] pt-3 md:border-0 md:pt-0">
                          <button
                            onClick={() => router.push(`/files/${file.id}`)}
                            title="View document"
                            aria-label={`View ${file.filename}`}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#69747b] transition-colors hover:bg-[#e6edf2] hover:text-[#405f73]"
                          >
                            <Eye size={17} />
                          </button>

                          <button
                            onClick={() => openEditDialog(file)}
                            title="Edit document"
                            aria-label={`Edit ${file.filename}`}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#69747b] transition-colors hover:bg-[#e6edf2] hover:text-[#405f73]"
                          >
                            <Edit3 size={16} />
                          </button>

                          <button
                            onClick={() =>
                              handleDownload(file.url, file.filename)
                            }
                            title="Download document"
                            aria-label={`Download ${file.filename}`}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#69747b] transition-colors hover:bg-[#e6edf2] hover:text-[#405f73]"
                          >
                            <Download size={17} />
                          </button>

                          <button
                            onClick={() => {
                              setFileToDelete(file.id);
                              setConfirmDeleteDialogOpen(true);
                            }}
                            title="Delete document"
                            aria-label={`Delete ${file.filename}`}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#89949a] transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {!loadingFiles && totalDocuments > 0 && (
                <div className="flex flex-col gap-3 border-t border-[#edf0f1] bg-[#fafbfb] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <p className="text-sm text-[#69747b]">
                    Showing{" "}
                    <span className="font-medium text-[#27333b]">
                      {startIndex}–{endIndex}
                    </span>{" "}
                    of{" "}
                    <span className="font-medium text-[#27333b]">
                      {totalDocuments}
                    </span>{" "}
                    documents
                    {search && (
                      <span className="ml-1 text-[#89949a]">
                        · {filteredFiles.length} matching on this page
                      </span>
                    )}
                  </p>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((previous) => previous - 1)}
                      className="h-9 rounded-full border-[#dce3e6] bg-white px-4 text-[#405f73] hover:bg-[#f0f3f4]"
                    >
                      <ChevronLeft size={16} className="mr-1" />
                      Previous
                    </Button>

                    <span className="px-2 text-xs font-medium text-[#89949a]">
                      Page {currentPage}
                    </span>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={endIndex >= totalDocuments}
                      onClick={() => setCurrentPage((previous) => previous + 1)}
                      className="h-9 rounded-full border-[#dce3e6] bg-white px-4 text-[#405f73] hover:bg-[#f0f3f4]"
                    >
                      Next
                      <ChevronRight size={16} className="ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section>

          <p className="mt-6 text-center text-xs text-[#9aa3a8]">
            Your health documents, organized in one place.
          </p>
        </main>
      </div>

      {/* Upload document dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);

          if (!open && !uploading) {
            setFileToUpload(null);
            setCustomFilename("");
            setTagsInput("");

            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          }
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg rounded-2xl border-[#e4e8e9] bg-white p-6">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-[#e6edf2] text-[#405f73]">
              <Upload size={20} />
            </div>

            <DialogTitle className="text-xl font-semibold text-[#27333b]">
              Upload a document
            </DialogTitle>

            <DialogDescription className="text-sm leading-6 text-[#69747b]">
              Add a health document to your personal library. You can give it
              a custom name and add tags to help keep it organized.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#27333b]">
                Choose a file
              </label>

              <input
                ref={fileInputRef}
                type="file"
                onChange={(event) =>
                  setFileToUpload(event.target.files?.[0] || null)
                }
                className="block w-full cursor-pointer rounded-xl border border-[#e4e8e9] bg-[#fafbfb] text-sm text-[#69747b] file:mr-4 file:cursor-pointer file:border-0 file:bg-[#e6edf2] file:px-4 file:py-3 file:text-sm file:font-medium file:text-[#405f73] hover:file:bg-[#dce6ed]"
              />

              {fileToUpload && (
                <div className="mt-2 flex items-center gap-2 text-xs text-[#587587]">
                  <FileText size={14} />
                  <span className="truncate">{fileToUpload.name}</span>
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#27333b]">
                Custom filename
                <span className="ml-1 font-normal text-[#89949a]">
                  (optional)
                </span>
              </label>

              <Input
                placeholder="e.g. Annual blood work"
                value={customFilename}
                onChange={(event) => setCustomFilename(event.target.value)}
                className="h-11 rounded-xl border-[#e4e8e9] bg-[#fafbfb] focus-visible:ring-[#718b9b]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#27333b]">
                Tags
                <span className="ml-1 font-normal text-[#89949a]">
                  (optional)
                </span>
              </label>

              <Input
                placeholder="e.g. blood work, annual checkup"
                value={tagsInput}
                onChange={(event) => setTagsInput(event.target.value)}
                className="h-11 rounded-xl border-[#e4e8e9] bg-[#fafbfb] focus-visible:ring-[#718b9b]"
              />

              <p className="mt-1.5 text-xs text-[#89949a]">
                Separate multiple tags with commas.
              </p>
            </div>
          </div>

          <DialogFooter className="mt-6 flex-col-reverse gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={uploading}
              className="h-10 rounded-full border-[#dce3e6] px-5 text-[#69747b]"
            >
              Cancel
            </Button>

            <Button
              onClick={handleUpload}
              disabled={!fileToUpload || uploading}
              className="h-10 rounded-full bg-[#405f73] px-5 text-white hover:bg-[#324e60]"
            >
              {uploading ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={16} className="mr-2" />
                  Upload document
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export health report dialog */}
      <Dialog open={healthDialogOpen} onOpenChange={setHealthDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg rounded-2xl border-[#e4e8e9] bg-white p-6">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-[#e6edf2] text-[#405f73]">
              <HeartPulse size={21} />
            </div>

            <DialogTitle className="text-xl font-semibold text-[#27333b]">
              Create a health report
            </DialogTitle>

            <DialogDescription className="text-sm leading-6 text-[#69747b]">
              Select the PDF and image documents you'd like to combine into
              one downloadable report.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
            {reportEligibleFiles.length > 0 ? (
              reportEligibleFiles.map((file) => {
                const checked = selectedForReport.includes(file.id);

                return (
                  <label
                    key={file.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                      checked
                        ? "border-[#9aafbd] bg-[#f1f5f7]"
                        : "border-[#e8ecee] bg-white hover:bg-[#fafbfb]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        setSelectedForReport((previous) =>
                          event.target.checked
                            ? [...previous, file.id]
                            : previous.filter((id) => id !== file.id),
                        );
                      }}
                      className="h-4 w-4 accent-[#405f73]"
                    />

                    <FileText size={18} className="shrink-0 text-[#587587]" />

                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#27333b]">
                      {file.filename}
                    </span>

                    <span className="shrink-0 text-xs text-[#89949a]">
                      {getFileTypeLabel(file.file_type)}
                    </span>
                  </label>
                );
              })
            ) : (
              <p className="rounded-xl bg-[#fafbfb] px-4 py-6 text-center text-sm text-[#69747b]">
                No PDF or image documents are available on this page.
              </p>
            )}
          </div>

          <p className="text-xs text-[#89949a]">
            {selectedForReport.length} document
            {selectedForReport.length === 1 ? "" : "s"} selected
          </p>

          <DialogFooter className="mt-4 flex-col-reverse gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setHealthDialogOpen(false)}
              disabled={reportProcessing}
              className="h-10 rounded-full border-[#dce3e6] px-5 text-[#69747b]"
            >
              Cancel
            </Button>

            <Button
              onClick={handleExportHealthReport}
              disabled={reportProcessing || selectedForReport.length === 0}
              className="h-10 rounded-full bg-[#405f73] px-5 text-white hover:bg-[#324e60]"
            >
              {reportProcessing ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Creating report...
                </>
              ) : (
                <>
                  <Download size={16} className="mr-2" />
                  Export report
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit document dialog */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);

          if (!open) {
            setEditingFile(null);
            setEditFilename("");
            setEditTagsInput("");
          }
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl border-[#e4e8e9] bg-white p-6">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-[#e6edf2] text-[#405f73]">
              <Edit3 size={19} />
            </div>

            <DialogTitle className="text-xl font-semibold text-[#27333b]">
              Edit document details
            </DialogTitle>

            <DialogDescription className="text-sm leading-6 text-[#69747b]">
              Update the name or tags associated with this document.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#27333b]">
                Filename
              </label>

              <Input
                value={editFilename}
                onChange={(event) => setEditFilename(event.target.value)}
                placeholder="Document filename"
                className="h-11 rounded-xl border-[#e4e8e9] bg-[#fafbfb] focus-visible:ring-[#718b9b]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#27333b]">
                Tags
              </label>

              <Input
                value={editTagsInput}
                onChange={(event) => setEditTagsInput(event.target.value)}
                placeholder="e.g. lab results, checkup"
                className="h-11 rounded-xl border-[#e4e8e9] bg-[#fafbfb] focus-visible:ring-[#718b9b]"
              />

              <p className="mt-1.5 text-xs text-[#89949a]">
                Separate multiple tags with commas.
              </p>
            </div>
          </div>

          <DialogFooter className="mt-6 flex-col-reverse gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={savingEdit}
              className="h-10 rounded-full border-[#dce3e6] px-5 text-[#69747b]"
            >
              Cancel
            </Button>

            <Button
              onClick={handleSaveEdit}
              disabled={savingEdit || !editFilename.trim()}
              className="h-10 rounded-full bg-[#405f73] px-5 text-white hover:bg-[#324e60]"
            >
              {savingEdit ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={confirmDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!deleting) {
            setConfirmDeleteDialogOpen(open);

            if (!open) {
              setFileToDelete(null);
            }
          }
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-2xl border-[#e4e8e9] bg-white p-6">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <Trash2 size={19} />
            </div>

            <DialogTitle className="text-xl font-semibold text-[#27333b]">
              Delete this document?
            </DialogTitle>

            <DialogDescription className="text-sm leading-6 text-[#69747b]">
              This will remove the document from your library. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-5 flex-col-reverse gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                setConfirmDeleteDialogOpen(false);
                setFileToDelete(null);
              }}
              disabled={deleting}
              className="h-10 rounded-full border-[#dce3e6] px-5 text-[#69747b]"
            >
              Cancel
            </Button>

            <Button
              onClick={handleDelete}
              disabled={deleting}
              variant="destructive"
              className="h-10 rounded-full px-5"
            >
              {deleting ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete document"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}