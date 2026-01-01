import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const adminEmail = 'jtc.adm@gmail.com'
    const adminPassword = 'Jardiel021.L'

    // First, try to find existing user by email
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === adminEmail.toLowerCase())

    let userId: string

    if (existingUser) {
      // User exists, update password
      console.log('Admin user exists, updating password...')
      const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        { 
          password: adminPassword,
          email_confirm: true
        }
      )

      if (updateError) {
        console.error('Update error:', updateError)
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      userId = existingUser.id
      console.log('Admin password updated for user:', userId)
    } else {
      // Create new admin user
      console.log('Creating new admin user...')
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        user_metadata: {
          full_name: 'Administrador JTC',
          cpf: '99999999999',
          phone: '98981091476',
          cep: '00000000',
          street: 'Admin',
          number: '0',
          neighborhood: 'Admin',
          city: 'Admin',
          state: 'AD',
          is_admin: true
        }
      })

      if (authError) {
        console.error('Auth error:', authError)
        return new Response(
          JSON.stringify({ error: authError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      userId = authData.user!.id
      console.log('Admin user created:', userId)
    }

    // Ensure profile exists and has permanent subscription
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (!profileData) {
      // Create profile if it doesn't exist
      const { error: insertError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: userId,
          email: adminEmail,
          full_name: 'Administrador JTC',
          cpf: '99999999999',
          subscription_ends_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
          subscription_plan: 'admin',
          trial_ends_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString()
        })

      if (insertError) {
        console.error('Profile insert error:', insertError)
      }
    } else {
      // Update existing profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          subscription_ends_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
          subscription_plan: 'admin',
          trial_ends_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString()
        })
        .eq('id', userId)

      if (profileError) {
        console.error('Profile update error:', profileError)
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Usuário admin configurado com sucesso!',
        email: adminEmail,
        userId: userId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
