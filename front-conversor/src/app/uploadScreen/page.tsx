"use client";
import React, { useState } from "react";
import axios from "axios";
import Header from "../../components/headerBar";
import { AlertCircle, CheckCircle2, Upload } from "lucide-react";

// Configuração da URL base do backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface UploadStatus {
  status: "idle" | "uploading" | "converting" | "success" | "error";
  message: string;
}

const UploadScreen = () => {
  const [file, setFile] = useState<File | null>(null);
  const [fileExtension, setFileExtension] = useState<string>("");
  const [selectedFormat, setSelectedFormat] = useState<string>("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    status: "idle",
    message: "",
  });

  // Formatos disponíveis para conversão
  const conversionOptions = ["mp3", "mp4", "avi", "wav", "mkv"];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setDownloadUrl(null);
      setUploadStatus({ status: "idle", message: "" });

      // Identificar extensão do arquivo
      const extension = selectedFile.name.split(".").pop()?.toLowerCase() || "";
      setFileExtension(extension);
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedFormat) {
      setUploadStatus({
        status: "error",
        message: "Selecione um arquivo e escolha o formato de conversão.",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("inputFormat", fileExtension);
    formData.append("outputFormat", selectedFormat);

    try {
      setUploadStatus({
        status: "uploading",
        message: "Enviando arquivo...",
      });

      const response = await axios.post(`${API_BASE_URL}/api/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 100)
          );
          setUploadStatus({
            status: "uploading",
            message: `Enviando arquivo... ${percentCompleted}%`,
          });
        },
      });

      setUploadStatus({
        status: "success",
        message: "Arquivo convertido com sucesso!",
      });
      setDownloadUrl(response.data.downloadUrl);
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error || "Falha no envio do arquivo. Tente novamente.";
      setUploadStatus({
        status: "error",
        message: errorMessage,
      });
    }
  };

  const StatusMessage = () => {
    if (uploadStatus.status === "idle") return null;

    const statusStyles = {
      error: "bg-red-100 text-red-800 border-red-300",
      success: "bg-green-100 text-green-800 border-green-300",
      uploading: "bg-blue-100 text-blue-800 border-blue-300",
      converting: "bg-yellow-100 text-yellow-800 border-yellow-300",
    };

    const StatusIcon = () => {
      switch (uploadStatus.status) {
        case "error":
          return <AlertCircle className="w-5 h-5" />;
        case "success":
          return <CheckCircle2 className="w-5 h-5" />;
        default:
          return <Upload className="w-5 h-5 animate-pulse" />;
      }
    };

    return (
      <div
        className={`mb-4 p-3 rounded-md border flex items-center gap-2 ${
          statusStyles[uploadStatus.status]
        }`}
      >
        <StatusIcon />
        <span>{uploadStatus.message}</span>
      </div>
    );
  };

  return (
    <div>
      <Header />
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="w-full max-w-md p-6 bg-white rounded-2xl shadow-md">
          <h1 className="text-xl font-semibold mb-4 text-center">
            Upload e Conversão de Arquivo
          </h1>

          <StatusMessage />

          <input
            type="file"
            onChange={handleFileChange}
            className="mb-4 w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            accept={conversionOptions.map((format) => `.${format}`).join(",")}
          />

          {fileExtension && (
            <p className="mb-4 text-sm text-gray-600">
              Tipo de arquivo detectado:{" "}
              <span className="font-semibold">{fileExtension}</span>
            </p>
          )}

          <div className="mb-4">
            <p className="text-sm font-semibold mb-2">
              Escolha o formato de conversão:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {conversionOptions.map((format) => (
                <label
                  key={format}
                  className="flex items-center p-2 border rounded-md hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="conversionFormat"
                    value={format}
                    onChange={() => setSelectedFormat(format)}
                    className="mr-2"
                  />
                  {format.toUpperCase()}
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={handleUpload}
            disabled={uploadStatus.status === "uploading"}
            className={`w-full py-2 px-4 rounded-md text-white font-semibold ${
              uploadStatus.status === "uploading"
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600"
            }`}
          >
            {uploadStatus.status === "uploading" ? "Enviando..." : "Enviar Arquivo"}
          </button>

          {downloadUrl && (
            <a
              href={downloadUrl}
              className="mt-4 inline-block w-full text-center py-2 px-4 rounded-md bg-green-500 text-white font-semibold hover:bg-green-600"
              download
            >
              Baixar Arquivo Convertido
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadScreen;