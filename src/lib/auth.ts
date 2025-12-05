import { supabase } from "@/integrations/supabase/client";

export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  cpf: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  referredByCode?: string;
}

export const signUp = async (data: SignUpData) => {
  const { error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      emailRedirectTo: `${window.location.origin}/`,
      data: {
        full_name: data.fullName,
        cpf: data.cpf,
        phone: data.phone,
        cep: data.cep,
        street: data.street,
        number: data.number,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state,
        referred_by_code: data.referredByCode || null,
      },
    },
  });

  if (error) {
    if (error.message && error.message.toLowerCase().includes("database error saving new user")) {
      throw new Error("Já existe um usuário cadastrado com este CPF ou e-mail.");
    }

    throw error;
  }
};

export const signIn = async (identifier: string, password: string) => {
  // Verificar se é CPF ou email
  const isCPF = /^\d{11}$/.test(identifier.replace(/\D/g, ""));
  
  if (isCPF) {
    // Buscar email pelo CPF
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email")
      .eq("cpf", identifier.replace(/\D/g, ""))
      .single();

    if (profileError || !profile) {
      throw new Error("CPF não encontrado");
    }

    identifier = profile.email;
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: identifier,
    password,
  });

  if (error) throw error;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

// Validar código de convite
export const validateInviteCode = async (code: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("invite_code", code.toUpperCase())
    .single();

  return !error && !!data;
};
