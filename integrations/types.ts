export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      relatos_exercicios: {
        Row: { id: string; usuario_id: string; exercicio_id: string; observacao: string | null; criado_em: string }
        Insert: { usuario_id: string; exercicio_id: string; observacao?: string | null }
        Update: never
        Relationships: [{ foreignKeyName: "relatos_exercicios_exercicio_id_fkey"; columns: ["exercicio_id"]; isOneToOne: false; referencedRelation: "exercicios"; referencedColumns: ["id"] }]
      }
      avaliacoes_temas: {
        Row: { id: string; usuario_id: string; dia: string; vaga: number; criado_em: string }
        Insert: { usuario_id: string; vaga: number }
        Update: never
        Relationships: []
      }
      youtube_recomendacoes: {
        Row: { trilha_id: string; contexto: string; estado: string; videos: Json; criado_em: string }
        Insert: { trilha_id: string; contexto?: string }
        Update: { estado?: string; videos?: Json }
        Relationships: [{
          foreignKeyName: "youtube_recomendacoes_trilha_id_fkey"
          columns: ["trilha_id"]
          isOneToOne: false
          referencedRelation: "trilhas"
          referencedColumns: ["id"]
        }]
      }
      geracoes_trilhas: {
        Row: { id: string; usuario_id: string; dia: string; vaga: number; criado_em: string }
        Insert: { usuario_id: string; vaga: number }
        Update: never
        Relationships: []
      }
      geracoes_modulos: {
        Row: { geracao_id: string; posicao: number }
        Insert: { geracao_id: string; posicao: number }
        Update: never
        Relationships: [{
          foreignKeyName: "geracoes_modulos_geracao_id_fkey"
          columns: ["geracao_id"]
          isOneToOne: false
          referencedRelation: "geracoes_trilhas"
          referencedColumns: ["id"]
        }]
      }
      exercicios: {
        Row: {
          tipo: "legado" | "multipla_escolha" | "previsao_saida"
          alternativas: Json | null
          criado_em: string
          dica: string | null
          explicacao: string | null
          id: string
          modulo_id: string
          ordem: number
          pergunta: string
          resposta_esperada: string
        }
        Insert: {
          tipo?: "legado" | "multipla_escolha" | "previsao_saida"
          alternativas?: Json | null
          criado_em?: string
          dica?: string | null
          explicacao?: string | null
          id?: string
          modulo_id: string
          ordem: number
          pergunta: string
          resposta_esperada: string
        }
        Update: {
          tipo?: "legado" | "multipla_escolha" | "previsao_saida"
          alternativas?: Json | null
          criado_em?: string
          dica?: string | null
          explicacao?: string | null
          id?: string
          modulo_id?: string
          ordem?: number
          pergunta?: string
          resposta_esperada?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercicios_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
        ]
      }
      modulos: {
        Row: {
          conteudo: string
          criado_em: string
          id: string
          ordem: number
          titulo: string
          trilha_id: string
        }
        Insert: {
          conteudo?: string
          criado_em?: string
          id?: string
          ordem: number
          titulo: string
          trilha_id: string
        }
        Update: {
          conteudo?: string
          criado_em?: string
          id?: string
          ordem?: number
          titulo?: string
          trilha_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "modulos_trilha_id_fkey"
            columns: ["trilha_id"]
            isOneToOne: false
            referencedRelation: "trilhas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          criado_em: string
          email: string | null
          id: string
          nome: string | null
        }
        Insert: {
          criado_em?: string
          email?: string | null
          id: string
          nome?: string | null
        }
        Update: {
          criado_em?: string
          email?: string | null
          id?: string
          nome?: string | null
        }
        Relationships: []
      }
      respostas: {
        Row: {
          acertou: boolean
          criado_em: string
          exercicio_id: string
          feedback: string | null
          id: string
          resposta: string
          usuario_id: string
        }
        Insert: {
          acertou?: boolean
          criado_em?: string
          exercicio_id: string
          feedback?: string | null
          id?: string
          resposta: string
          usuario_id: string
        }
        Update: {
          acertou?: boolean
          criado_em?: string
          exercicio_id?: string
          feedback?: string | null
          id?: string
          resposta?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "respostas_exercicio_id_fkey"
            columns: ["exercicio_id"]
            isOneToOne: false
            referencedRelation: "exercicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trilhas: {
        Row: {
          criado_em: string
          descricao: string | null
          id: string
          linguagem: string
          nivel: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          criado_em?: string
          descricao?: string | null
          id?: string
          linguagem: string
          nivel: string
          titulo: string
          usuario_id: string
        }
        Update: {
          criado_em?: string
          descricao?: string | null
          id?: string
          linguagem?: string
          nivel?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trilhas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      reservar_geracao_trilha: { Args: Record<PropertyKey, never>; Returns: string }
      reservar_avaliacao_tema: { Args: Record<PropertyKey, never>; Returns: number }
      consultar_avaliacoes_hoje: { Args: Record<PropertyKey, never>; Returns: number }
      consultar_geracoes_hoje: { Args: Record<PropertyKey, never>; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"]
