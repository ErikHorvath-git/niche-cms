const userProfilesTable = 'user_profiles';

module.exports = (supabaseAdmin) => {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client is required for auth middleware');
  }

  return async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token missing' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const { data, error: userError } = await supabaseAdmin.auth.getUser(token);
      const user = data?.user;

      if (userError || !user) {
        console.error('Supabase getUser failed', userError);
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      const { data: profile, error: profileError } = await supabaseAdmin
        .from(userProfilesTable)
        .select('id, user_id, client_id, role, full_name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Failed to load user profile in middleware', profileError);
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!profile) {
        return res.status(401).json({ error: 'User profile not found' });
      }

      req.user = {
        id: user.id,
        email: user.email,
        clientId: profile.client_id,
        role: profile.role,
        profileId: profile.id,
        profile
      };
      req.clientId = profile.client_id;

      next();
    } catch (error) {
      console.error('Authentication middleware failed', error);
      res.status(401).json({ error: 'Unauthorized' });
    }
  };
};
