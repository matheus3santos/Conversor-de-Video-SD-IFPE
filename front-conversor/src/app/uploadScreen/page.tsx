"use client";
import React, { useState } from "react";
import axios from "axios";
import Header from "../../components/headerBar";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const UploadScreen = () => {
  const [file, setFile] = useState<File | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const conversionOptions = ["mp3", "mp4", "avi", "wav"];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validação do tamanho do arquivo (exemplo: 100MB)
      if (selectedFile.size > 100 * 1024 * 1024) {
        setErrorMessage("Arquivo muito grande. Limite máximo de 100MB.");
        return;
      }

      const extension = selectedFile.name.split(".").pop()?.toLowerCase() || "";
      setFile(selectedFile);
      setSelectedFormat(extension);
      setErrorMessage("");
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (errorMessage && validateEmail(e.target.value)) {
      setErrorMessage("");
    }
  };

  const handleUpload = async () => {
    // Validações melhoradas
    if (!file) {
      setErrorMessage("Por favor, selecione um arquivo.");
      return;
    }

    if (!selectedFormat) {
      setErrorMessage("Por favor, selecione um formato de conversão.");
      return;
    }

    if (!email) {
      setErrorMessage("Por favor, informe seu email.");
      return;
    }

    if (!validateEmail(email)) {
      setErrorMessage("Por favor, informe um email válido.");
      return;
    }

    setUploadStatus("uploading");
    setErrorMessage("");
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("outputFormat", selectedFormat);
    formData.append("email", email.trim().toLowerCase());

    try {
      const response = await axios.post(`${API_BASE_URL}/api/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setUploadProgress(progress);
        },
      });

      if (response.data.success) {
        setUploadStatus("success");
        setErrorMessage("");
        // Limpar formulário após sucesso
        setFile(null);
        setEmail("");
        setSelectedFormat("");
        // Reset file input
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) fileInput.value = "";
      }
    } catch (error: any) {
      setUploadStatus("error");
      setErrorMessage(
        error.response?.data?.error ||
        "Erro ao enviar o arquivo. Tente novamente."
      );
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

          {/* Status Messages */}
          {uploadStatus === "error" && (
            <div className="mb-4 p-3 rounded-md border bg-red-100 text-red-800 border-red-300 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2" />
              {errorMessage}
            </div>
          )}

          {uploadStatus === "success" && (
            <div className="mb-4 p-3 rounded-md border bg-green-100 text-green-800 border-green-300 flex items-center">
              <CheckCircle2 className="w-5 h-5 mr-2" />
              Arquivo enviado com sucesso! Você receberá um email quando a conversão estiver pronta.
            </div>
          )}

          {/* Form Fields */}
          <input
            type="email"
            value={email}
            onChange={handleEmailChange}
            placeholder="Digite seu e-mail"
            className="mb-4 w-full px-4 py-2 text-sm text-gray-500 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />

          <input
            type="file"
            onChange={handleFileChange}
            className="mb-4 w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            required
          />

          {/* Upload Progress */}
          {uploadStatus === "uploading" && (
            <div className="mb-4">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-500 mt-1 text-center">
                {uploadProgress}% enviado
              </p>
            </div>
          )}

          {/* Conversion Format Selection */}
          <div className="mb-4">
            <p className="text-sm font-semibold mb-2">
              Escolha o formato de conversão:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {conversionOptions.map((format) => (
                <label
                  key={format}
                  className={`flex items-center p-2 border rounded-md hover:bg-gray-50 cursor-pointer ${selectedFormat === format ? "bg-blue-50 border-blue-500" : ""
                    }`}
                >
                  <input
                    type="radio"
                    name="conversionFormat"
                    value={format}
                    onChange={() => setSelectedFormat(format)}
                    className="mr-2"
                    checked={selectedFormat === format}
                  />
                  {format.toUpperCase()}
                </label>
              ))}
            </div>
          </div>

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={uploadStatus === "uploading"}
            className={`w-full py-2 px-4 rounded-md text-white font-semibold flex items-center justify-center ${uploadStatus === "uploading"
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600"
              }`}
          >
            {uploadStatus === "uploading" ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Enviando...
              </>
            ) : (
              "Enviar Arquivo"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadScreen;