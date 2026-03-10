import * as ImagePicker from "expo-image-picker";

const SUPABASE_URL = "https://rxddaoqispbdxkzaygrd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4ZGRhb3Fpc3BiZHhremF5Z3JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2ODA2MzEsImV4cCI6MjA4ODI1NjYzMX0.ehAgRPEJAK9ogQXYpMYeGK3OyOcfw4HDkb3s4SIg2U8";
const BUCKET = "avatars";

export async function pickAndUploadPhoto(userId) {
  try {
    // 1. Request permission
    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    console.log("PERMISSION:", permResult.status);
    if (permResult.status !== "granted") {
      throw new Error("Camera roll permission denied");
    }

    // 2. Launch picker
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,  // request base64 directly from picker
    });

    console.log("PICKER CANCELED:", pickerResult.canceled);
    console.log("PICKER ASSETS:", pickerResult.assets?.length);

    if (pickerResult.canceled) return null;
    if (!pickerResult.assets || pickerResult.assets.length === 0) return null;

    const asset = pickerResult.assets[0];
    console.log("ASSET URI:", asset.uri ? "exists" : "missing");
    console.log("ASSET BASE64:", asset.base64 ? `${asset.base64.length} chars` : "missing");

    if (!asset.base64) {
      throw new Error("base64 not returned from image picker");
    }

    // 3. Convert base64 to binary
    const fileName = `${userId}-${Date.now()}.jpg`;
    const byteCharacters = atob(asset.base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);

    // 4. Upload to Supabase
    console.log("UPLOADING to Supabase...");
    const uploadRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${fileName}`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "image/jpeg",
          "x-upsert": "true",
        },
        body: byteArray,
      }
    );

    const uploadText = await uploadRes.text();
    console.log("UPLOAD STATUS:", uploadRes.status);
    console.log("UPLOAD RESPONSE:", uploadText);

    if (!uploadRes.ok) {
      throw new Error(`Upload failed (${uploadRes.status}): ${uploadText}`);
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${fileName}`;
    console.log("PUBLIC URL:", publicUrl);
    return publicUrl;

  } catch (err) {
    console.error("UPLOAD ERROR:", err.message);
    throw err;
  }
}
