import { useMutation, useQuery } from "@tanstack/react-query";

import { apiClient } from "./client";
import type {
  ChartResponse,
  MidiExportRequest,
  MoversResponse,
  SonifyRequest,
  SonifyResponse,
} from "./types";

export function useChartData(
  ticker: string,
  start: string,
  end: string,
  interval: string = "1d"
) {
  return useQuery({
    queryKey: ["chart", ticker, start, end, interval],
    queryFn: async () => {
      const { data } = await apiClient.get<ChartResponse>(`/api/chart/${ticker}`, {
        params: { start, end, interval },
      });
      return data;
    },
    enabled: !!ticker && !!start && !!end,
  });
}

export function useTopMovers() {
  return useQuery({
    queryKey: ["movers"],
    queryFn: async () => {
      const { data } = await apiClient.get<MoversResponse>("/api/movers");
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSonify() {
  return useMutation({
    mutationFn: async (request: SonifyRequest) => {
      const { data } = await apiClient.post<SonifyResponse>("/api/sonify", request);
      return data;
    },
  });
}

export function useMidiExport() {
  return useMutation({
    mutationFn: async (request: MidiExportRequest) => {
      const response = await apiClient.post("/api/midi", request, {
        responseType: "blob",
      });

      const url = URL.createObjectURL(response.data as Blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "candletunes.mid";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
  });
}
