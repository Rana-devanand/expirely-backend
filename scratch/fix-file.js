const fs = require('fs');
const path = 'd:\\focusAi\\smart Expirary tracker\\Backend\\app\\modules\\user\\user.services.ts';
let content = fs.readFileSync(path, 'utf8');

const targetStr = '  async saveLocation(userId: string, country: string, locality: string) {';
const index = content.indexOf(targetStr);
if (index !== -1) {
  content = content.substring(0, index) + `  async saveLocation(userId: string, country: string, locality: string) {
    const { data, error } = await supabaseAdmin
      .from("user_locations")
      .upsert({
        user_id: userId,
        country,
        locality,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getLocation(userId: string) {
    const { data, error } = await supabaseAdmin
      .from("user_locations")
      .select("country, locality")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async getAllUserLocations() {
    const { data: locations, error } = await supabaseAdmin
      .from("user_locations")
      .select(\`
        user_id,
        country,
        locality,
        created_at,
        updated_at,
        users:users(username, email, avatar_url)
      \`)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (locations || []).map((loc: any) => {
      const user = Array.isArray(loc.users) ? loc.users[0] : loc.users;
      return {
        userId: loc.user_id,
        userName: user?.username || 'N/A',
        userEmail: user?.email || 'N/A',
        avatarUrl: user?.avatar_url || null,
        country: loc.country,
        state: loc.locality,
        createdAt: loc.created_at,
        updatedAt: loc.updated_at
      };
    });
  }
}

export const userService = new UserService();
`;
  fs.writeFileSync(path, content, 'utf8');
  console.log("✅ Success cleaning user.services.ts file!");
} else {
  console.log("❌ Section saveLocation not found in file!");
}
