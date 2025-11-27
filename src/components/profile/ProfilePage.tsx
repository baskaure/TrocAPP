import { useState, useEffect, ChangeEvent } from 'react';
import { MapPin, Mail, Phone, Calendar, Edit2, X, Check, Camera, ImageUp, Loader2, Star } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { supabase, Review } from '../../lib/supabase';

type ReviewWithReviewer = Review & {
  reviewer?: { display_name: string; avatar_url?: string };
};

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reviews, setReviews] = useState<ReviewWithReviewer[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [listingsCount, setListingsCount] = useState(0);
  const [mediaUploading, setMediaUploading] = useState({
    avatar: false,
    banner: false,
  });

  const [formData, setFormData] = useState({
    display_name: '',
    username: '',
    bio: '',
    phone: '',
    city: '',
    country: '',
    languages: [] as string[],
    skills: [] as string[],
    search_radius_km: 50,
    avatar_url: '',
    banner_url: '',
  });
  const [newSkill, setNewSkill] = useState('');
  const [newLanguage, setNewLanguage] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        display_name: user.display_name || '',
        username: user.username || '',
        bio: user.bio || '',
        phone: user.phone || '',
        city: user.city || '',
        country: user.country || '',
        languages: user.languages || [],
        skills: user.skills || [],
        search_radius_km: user.search_radius_km || 50,
        avatar_url: user.avatar_url || '',
        banner_url: user.banner_url || '',
      });
      loadReviews();
      loadListingsCount();
    }
  }, [user]);

  async function loadListingsCount() {
    if (!user) return;
    try {
      const { count, error } = await supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'published');

      if (!error && count !== null) {
        setListingsCount(count);
      }
    } catch (err) {
      console.error('Error loading listings count:', err);
    }
  }

  async function loadReviews() {
    if (!user) return;
    setReviewsLoading(true);
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          reviewer:users!reviews_reviewer_id_fkey(display_name, avatar_url)
        `)
        .eq('reviewee_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (err) {
      console.error('Error loading reviews:', err);
    } finally {
      setReviewsLoading(false);
    }
  }

  const uploadProfileMedia = async (file: File, type: 'avatar' | 'banner') => {
    if (!user) return;

    setMediaUploading((prev) => ({ ...prev, [type]: true }));
    setError('');

    try {
      const folder = type === 'avatar' ? 'avatars' : 'banners';
      const fileExt = file.name.split('.').pop() || 'bin';
      const fileName = `${folder}/${user.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-media')
        .upload(fileName, file, {
          upsert: true,
          contentType: file.type,
          cacheControl: '3600',
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('profile-media').getPublicUrl(fileName);
      if (!data?.publicUrl) {
        throw new Error('Impossible de récupérer le lien de l’image');
      }

      if (type === 'avatar') {
        setFormData((prev) => ({ ...prev, avatar_url: data.publicUrl }));
      } else {
        setFormData((prev) => ({ ...prev, banner_url: data.publicUrl }));
      }
    } catch (err) {
      console.error(err);
      if (err && typeof err === 'object' && 'message' in err) {
        setError(String(err.message));
      } else {
        setError('Erreur lors du téléversement de l’image');
      }
    } finally {
      setMediaUploading((prev) => ({ ...prev, [type]: false }));
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
    const file = event.target.files?.[0];
    if (file) {
      void uploadProfileMedia(file, type);
      event.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          display_name: formData.display_name,
          username: formData.username,
          bio: formData.bio,
          phone: formData.phone,
          city: formData.city,
          country: formData.country,
          languages: formData.languages,
          skills: formData.skills,
          search_radius_km: formData.search_radius_km,
          avatar_url: formData.avatar_url,
          banner_url: formData.banner_url,
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refreshUser();
      setSuccess('Profil mis à jour avec succès!');
      setIsEditing(false);

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      if (err && typeof err === 'object' && 'message' in err) {
        setError(String(err.message));
      } else {
        setError('Erreur lors de la mise à jour');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center text-gray-500">
          Veuillez vous connecter pour voir votre profil
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="relative h-40 bg-gradient-to-r from-blue-600 to-blue-700">
          {formData.banner_url && (
            <img
              src={formData.banner_url}
              alt="Bannière du profil"
              className="w-full h-full object-cover"
            />
          )}
          {isEditing && (
            <label className="absolute top-3 right-3 inline-flex items-center space-x-2 bg-black/60 text-white text-sm px-4 py-1.5 rounded-full cursor-pointer hover:bg-black/70 transition-colors">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => handleFileChange(event, 'banner')}
              />
              {mediaUploading.banner ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ImageUp className="w-4 h-4" />
              )}
              <span>{mediaUploading.banner ? 'Téléversement...' : 'Changer la bannière'}</span>
            </label>
          )}
        </div>

        <div className="px-6 pb-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-end space-x-4">
              <div className="relative w-32 h-32 -mt-20">
                {formData.avatar_url ? (
                  <img
                    src={formData.avatar_url}
                    alt={formData.display_name}
                    className="w-32 h-32 rounded-full border-4 border-white shadow-lg object-cover"
                  />
                ) : (
                  <div className="w-32 h-32 bg-gray-300 text-gray-600 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-4xl font-bold">
                    {formData.display_name[0]?.toUpperCase() || 'U'}
                  </div>
                )}

                {isEditing && (
                  <label className="absolute bottom-2 right-2 inline-flex items-center justify-center bg-blue-600 text-white rounded-full p-2 cursor-pointer hover:bg-blue-700 transition-colors shadow">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => handleFileChange(event, 'avatar')}
                    />
                    {mediaUploading.avatar ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                  </label>
                )}
              </div>

              <div className="pb-2">
                <h1 className="text-2xl font-bold text-gray-900">{formData.display_name}</h1>
                <p className="text-gray-500">@{formData.username}</p>
              </div>
            </div>

            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="mt-6 flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                <span>Modifier</span>
              </button>
            ) : (
              <div className="mt-16 flex space-x-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex items-center space-x-2 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span>Annuler</span>
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600">
              {success}
            </div>
          )}

          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom d'affichage
                  </label>
                  <input
                    type="text"
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom d'utilisateur
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ville
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pays
                  </label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rayon de recherche (km)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={formData.search_radius_km}
                    onChange={(e) => setFormData({ ...formData, search_radius_km: parseInt(e.target.value) || 50 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Langues parlées
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.languages.map((lang) => (
                    <span key={lang} className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                      {lang}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, languages: formData.languages.filter(l => l !== lang) })}
                        className="ml-2 text-blue-500 hover:text-blue-700"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newLanguage}
                    onChange={(e) => setNewLanguage(e.target.value)}
                    placeholder="Ajouter une langue"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newLanguage.trim()) {
                        e.preventDefault();
                        if (!formData.languages.includes(newLanguage.trim())) {
                          setFormData({ ...formData, languages: [...formData.languages, newLanguage.trim()] });
                        }
                        setNewLanguage('');
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newLanguage.trim() && !formData.languages.includes(newLanguage.trim())) {
                        setFormData({ ...formData, languages: [...formData.languages, newLanguage.trim()] });
                        setNewLanguage('');
                      }
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Ajouter
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Compétences / Tags
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.skills.map((skill) => (
                    <span key={skill} className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                      {skill}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, skills: formData.skills.filter(s => s !== skill) })}
                        className="ml-2 text-green-500 hover:text-green-700"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    placeholder="Ajouter une compétence"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newSkill.trim()) {
                        e.preventDefault();
                        if (!formData.skills.includes(newSkill.trim())) {
                          setFormData({ ...formData, skills: [...formData.skills, newSkill.trim()] });
                        }
                        setNewSkill('');
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newSkill.trim() && !formData.skills.includes(newSkill.trim())) {
                        setFormData({ ...formData, skills: [...formData.skills, newSkill.trim()] });
                        setNewSkill('');
                      }
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Ajouter
                  </button>
                </div>
              </div>

              <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Photos du profil
                </label>
                <p className="text-sm text-gray-500 mb-4">
                  Téléversez directement vos images (PNG, JPG ou WEBP). Elles sont enregistrées dans votre espace Supabase.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="flex flex-col items-center justify-center text-center px-3 py-4 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => handleFileChange(event, 'avatar')}
                    />
                    {mediaUploading.avatar ? (
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin mb-2" />
                    ) : (
                      <Camera className="w-5 h-5 text-blue-600 mb-2" />
                    )}
                    <span className="text-sm font-medium text-gray-700">
                      {mediaUploading.avatar ? 'Téléversement...' : 'Mettre à jour l’avatar'}
                    </span>
                  </label>

                  <label className="flex flex-col items-center justify-center text-center px-3 py-4 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => handleFileChange(event, 'banner')}
                    />
                    {mediaUploading.banner ? (
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin mb-2" />
                    ) : (
                      <ImageUp className="w-5 h-5 text-blue-600 mb-2" />
                    )}
                    <span className="text-sm font-medium text-gray-700">
                      {mediaUploading.banner ? 'Téléversement...' : 'Mettre à jour la bannière'}
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Biographie
                </label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Parlez-nous un peu de vous..."
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{loading ? 'Enregistrement...' : 'Enregistrer'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              {formData.bio && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Biographie</h3>
                  <p className="text-gray-700">{formData.bio}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-3 text-gray-600">
                  <Mail className="w-5 h-5" />
                  <span>{user.email}</span>
                </div>

                {(formData.city || formData.country) && (
                  <div className="flex items-center space-x-3 text-gray-600">
                    <MapPin className="w-5 h-5" />
                    <span>{[formData.city, formData.country].filter(Boolean).join(', ')}</span>
                  </div>
                )}

                {formData.phone && (
                  <div className="flex items-center space-x-3 text-gray-600">
                    <Phone className="w-5 h-5" />
                    <span>{formData.phone}</span>
                  </div>
                )}

                <div className="flex items-center space-x-3 text-gray-600">
                  <Calendar className="w-5 h-5" />
                  <span>Membre depuis {formatDate(user.created_at)}</span>
                </div>
              </div>

              {formData.languages.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Langues</h3>
                  <div className="flex flex-wrap gap-2">
                    {formData.languages.map((lang) => (
                      <span key={lang} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {formData.skills.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Compétences</h3>
                  <div className="flex flex-wrap gap-2">
                    {formData.skills.map((skill) => (
                      <span key={skill} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Statistiques</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{listingsCount}</div>
                    <div className="text-sm text-gray-600">Annonces</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{reviews.length}</div>
                    <div className="text-sm text-gray-600">Avis reçus</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600 flex items-center justify-center space-x-1">
                      {reviews.length > 0 ? (
                        <>
                          <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                          <span>{(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)}</span>
                        </>
                      ) : (
                        <span>-</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">Note moyenne</div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Avis reçus ({reviews.length})</h3>
                {reviewsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  </div>
                ) : reviews.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Aucun avis pour le moment</p>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <div key={review.id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                          {review.reviewer?.avatar_url ? (
                            <img
                              src={review.reviewer.avatar_url}
                              alt={review.reviewer.display_name}
                              className="w-10 h-10 rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                              {review.reviewer?.display_name?.[0]?.toUpperCase() || '?'}
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{review.reviewer?.display_name}</span>
                              <div className="flex items-center space-x-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`w-4 h-4 ${
                                      star <= review.rating
                                        ? 'fill-yellow-400 text-yellow-400'
                                        : 'text-gray-300'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                            {review.comment && (
                              <p className="text-gray-700 mt-2">{review.comment}</p>
                            )}
                            {review.tags && review.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {review.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            <p className="text-xs text-gray-500 mt-2">
                              {new Date(review.created_at).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
