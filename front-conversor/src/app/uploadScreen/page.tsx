"use client";
import React, { useState } from "react";
import axios from "axios";
import Header from "../../components/headerBar";
import { AlertCircle, Upload, Loader2, CheckCircle2, Download } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface UploadStatus {
  status: "idle" | "uploading" | "converting" | "success" | "error";
  message: string;
}

const UploadScreen = () => {
  const [file, setFile] = useState<File | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string>("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [blobName, setBlobName] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    status: "idle",
    message: "",
  });

  const conversionOptions = ["mp3", "mp4", "avi", "wav"];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setDownloadUrl(null);
      setUploadStatus({ status: "idle", message: "" });
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
    formData.append("outputFormat", selectedFormat);

    try {
      setUploadStatus({
        status: "uploading",
        message: "Enviando arquivo...",
      });

      const response = await axios.post(`${API_BASE_URL}/api/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setUploadStatus({
        status: "converting",
        message: "Convertendo arquivo...",
      });

      setBlobName(response.data.blobName);
      checkForConvertedFile(response.data.blobName);
      
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || "Falha no envio do arquivo. Tente novamente.";
      setUploadStatus({ status: "error", message: errorMessage });
    }
  };

  const checkForConvertedFile = async (blobName: string) => {
    let attempts = 0;
    const maxAttempts = 12; // Máximo de 60 segundos (12 tentativas de 5s)
    
    while (attempts < maxAttempts) {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/download/${blobName}`);
        
        if (response.data.downloadUrl) {
          setDownloadUrl(response.data.downloadUrl);
          setUploadStatus({
            status: "success",
            message: "Arquivo pronto para download!",
          });
          return;
        }
      } catch (error) {
        console.log("Arquivo ainda não disponível, tentando novamente...");
      }

      await new Promise((resolve) => setTimeout(resolve, 5000)); // Espera 5s antes de tentar novamente
      attempts++;
    }

    setUploadStatus({
      status: "error",
      message: "Ocorreu um erro ou o tempo de conversão expirou.",
    });
  };

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  };

  return (
    <div>
      <Header />
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="w-full max-w-md p-6 bg-white rounded-2xl shadow-md">
          <h1 className="text-xl font-semibold mb-4 text-center">
            Upload e Conversão de Arquivo
          </h1>

          {uploadStatus.status !== "idle" && (
            <div className={`mb-4 p-3 rounded-md border flex items-center gap-2 ${
              uploadStatus.status === "error" ? "bg-red-100 text-red-800 border-red-300" : "bg-blue-100 text-blue-800 border-blue-300"
            }`}>
              {uploadStatus.status === "error" ? <AlertCircle className="w-5 h-5" /> : <Upload className="w-5 h-5 animate-pulse" />}
              <span>{uploadStatus.message}</span>
            </div>
          )}

          <input
            type="file"
            onChange={handleFileChange}
            className="mb-4 w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
          />

          <div className="mb-4">
            <p className="text-sm font-semibold mb-2">Escolha o formato de conversão:</p>
            <div className="grid grid-cols-2 gap-2">
              {conversionOptions.map((format) => (
                <label key={format} className="flex items-center p-2 border rounded-md hover:bg-gray-50 cursor-pointer">
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
            disabled={uploadStatus.status === "uploading" || uploadStatus.status === "converting"}
            className={`w-full py-2 px-4 rounded-md text-white font-semibold ${
              uploadStatus.status === "uploading" || uploadStatus.status === "converting" ? "bg-gray-400 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600"
            }`}
          >
            {uploadStatus.status === "uploading" ? "Enviando..." : "Enviar Arquivo"}
          </button>

          {uploadStatus.status === "converting" && (
            <div className="flex justify-center items-center mt-4">
              <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
              <span className="ml-2 text-gray-600">Convertendo arquivo...</span>
            </div>
          )}

          {uploadStatus.status === "success" && downloadUrl && (
            <button
              onClick={handleDownload}
              className="mt-4 inline-block w-full text-center py-2 px-4 rounded-md bg-green-500 text-white font-semibold hover:bg-green-600 flex items-center justify-center"
            >
              <Download className="w-5 h-5 mr-2" />
              Baixar Arquivo Convertido
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadScreen;
