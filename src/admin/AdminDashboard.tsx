import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { ArrowLeft, RefreshCw, Trash2, Search, ExternalLink, ShieldCheck } from 'lucide-react';

type PlayerRow = {
  id: string;
  display_name: string;
  gender: string;
  onboarding_completed: boolean;
  created_at: string;
  last_active_at: string;
};

type WishRow = {
  id: string;
  profile_id: string;
  sender_name: string;
  content: string;
  flower_color: string;
  created_at: string;
  is_deleted: boolean;
};

export function AdminDashboard({ onExit }: { onExit: () => void }) {
  const [sessionUser, setSessionUser] = useState<unknown | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Dashboard state
  const [tab, setTab] = useState<'players' | 'wishes'>('players');
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [wishes, setWishes] = useState<WishRow[]>([]);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({ totalPlayers: 0, totalWishes: 0, completedOnboarding: 0 });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    checkAdminAuth();
  }, []);

  async function checkAdminAuth() {
    setLoading(true);
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSessionUser(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setSessionUser(user);
      // Kiểm tra trong bảng admin_users
      const { data: adminData } = await supabase
        .from('admin_users')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (adminData) {
        setIsAdmin(true);
        void loadDashboardData();
      } else {
        setIsAdmin(false);
      }
    } catch (err) {
      console.warn('[Admin] Check auth exception:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    if (!isSupabaseConfigured || !supabase) {
      setLoginError('Supabase chưa được cấu hình. Vui lòng thiết lập VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY.');
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setLoginError(error.message || 'Đăng nhập không thành công.');
        return;
      }

      if (data.user) {
        // Kiểm tra quyền admin
        const { data: adminRecord } = await supabase
          .from('admin_users')
          .select('role')
          .eq('user_id', data.user.id)
          .maybeSingle();

        if (!adminRecord) {
          setLoginError('Tài khoản này không có quyền quản trị viên GM TỰ.');
          await supabase.auth.signOut();
          return;
        }

        setSessionUser(data.user);
        setIsAdmin(true);
        void loadDashboardData();
      }
    } catch (err) {
      setLoginError((err as Error).message || 'Lỗi kết nối máy chủ.');
    }
  }

  async function handleLogout() {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setSessionUser(null);
    setIsAdmin(false);
  }

  async function loadDashboardData() {
    if (!supabase) return;
    setRefreshing(true);

    try {
      // 1. Tải danh sách người chơi
      const { data: pData, count: pCount } = await supabase
        .from('profiles')
        .select('id, display_name, gender, onboarding_completed, created_at, last_active_at', { count: 'exact' })
        .order('last_active_at', { ascending: false })
        .limit(50);

      if (pData) {
        setPlayers(pData as PlayerRow[]);
      }

      // 2. Tải danh sách lời chúc
      const { data: wData, count: wCount } = await supabase
        .from('wishes')
        .select('*', { count: 'exact' })
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(50);

      if (wData) {
        setWishes(wData as WishRow[]);
      }

      // 3. Đếm hoàn tất onboarding
      const { count: completedCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('onboarding_completed', true);

      setStats({
        totalPlayers: pCount || (pData?.length ?? 0),
        totalWishes: wCount || (wData?.length ?? 0),
        completedOnboarding: completedCount || 0,
      });
    } catch (err) {
      console.warn('[Admin] Tải dữ liệu lỗi:', err);
    } finally {
      setRefreshing(false);
    }
  }

  async function deleteWish(wishId: string) {
    if (!supabase || !confirm('Bạn có chắc chắn muốn xóa lời chúc này?')) return;
    try {
      await supabase.from('wishes').update({ is_deleted: true }).eq('id', wishId);
      setWishes((prev) => prev.filter((w) => w.id !== wishId));
    } catch (err) {
      alert('Không thể xóa: ' + (err as Error).message);
    }
  }

  if (loading) {
    return (
      <div className="admin-container">
        <p>Đang kiểm tra quyền quản trị…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="admin-container">
        <button className="text-action" onClick={onExit} style={{ marginBottom: 20 }}>
          <ArrowLeft size={16} /> Quay về GM TỰ
        </button>

        <section className="admin-login-box">
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <ShieldCheck size={36} color="#8a6c3f" />
          </div>
          <h2>Quản trị GM TỰ</h2>
          <p style={{ fontSize: 12, color: '#7a684b', marginBottom: 16, textAlign: 'center' }}>
            Đăng nhập bằng tài khoản quản trị viên được phân quyền trong Supabase.
          </p>

          {loginError && <p className="form-error" role="alert">{loginError}</p>}

          <form onSubmit={handleLogin}>
            <label htmlFor="admin-email">Email quản trị</label>
            <input
              id="admin-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@gmtu.vn"
            />

            <label htmlFor="admin-pass">Mật khẩu</label>
            <input
              id="admin-pass"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />

            <button className="primary" type="submit" style={{ width: '100%', minHeight: 42 }}>
              Đăng nhập trang quản trị
            </button>
          </form>
        </section>
      </div>
    );
  }

  const filteredPlayers = players.filter((p) =>
    p.display_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="admin-container">
      <header className="admin-header">
        <div>
          <button className="text-action" onClick={onExit} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <ArrowLeft size={16} /> Về chùa GM TỰ
          </button>
          <h1>Bảng điều khiển Ban Quản Trị</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="text-action" onClick={loadDashboardData} disabled={refreshing} title="Làm mới dữ liệu">
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> Làm mới
          </button>
          <button className="text-action" onClick={handleLogout}>Đăng xuất</button>
        </div>
      </header>

      {/* Thẻ thống kê */}
      <section className="admin-grid">
        <div className="admin-card">
          <small>Tổng số người chơi</small>
          <strong>{stats.totalPlayers}</strong>
        </div>
        <div className="admin-card">
          <small>Đã hoàn thành onboarding</small>
          <strong>{stats.completedOnboarding}</strong>
        </div>
        <div className="admin-card">
          <small>Lời chúc nhận được</small>
          <strong>{stats.totalWishes}</strong>
        </div>
        <div className="admin-card">
          <small>Cơ sở dữ liệu</small>
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, marginTop: 8, color: '#685036' }}
          >
            Supabase Studio <ExternalLink size={13} />
          </a>
        </div>
      </section>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <button
          className={tab === 'players' ? 'primary' : 'text-action'}
          onClick={() => setTab('players')}
          style={{ padding: '8px 16px', minHeight: 38 }}
        >
          Danh sách người chơi ({players.length})
        </button>
        <button
          className={tab === 'wishes' ? 'primary' : 'text-action'}
          onClick={() => setTab('wishes')}
          style={{ padding: '8px 16px', minHeight: 38 }}
        >
          Lời chúc hoa đăng ({wishes.length})
        </button>
      </div>

      {tab === 'players' ? (
        <section>
          <div className="admin-search-bar">
            <Search size={16} style={{ alignSelf: 'center', color: '#8c7654' }} />
            <input
              placeholder="Tìm kiếm theo tên người chơi…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Tên người chơi</th>
                  <th>Giới tính</th>
                  <th>Trạng thái vào chùa</th>
                  <th>Ngày tạo</th>
                  <th>Hoạt động gần nhất</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: '#8c7654', padding: 24 }}>
                      Chưa có người chơi nào hoặc không khớp tìm kiếm.
                    </td>
                  </tr>
                ) : (
                  filteredPlayers.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.display_name}</strong></td>
                      <td>{p.gender === 'female' ? 'Nữ' : p.gender === 'male' ? 'Nam' : '—'}</td>
                      <td>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 12,
                            fontSize: 10,
                            background: p.onboarding_completed ? '#e2f0d9' : '#fff2cc',
                            color: p.onboarding_completed ? '#275e1f' : '#8c6508',
                          }}
                        >
                          {p.onboarding_completed ? 'Đã vào chùa' : 'Đang tạo nhân vật'}
                        </span>
                      </td>
                      <td>{new Date(p.created_at).toLocaleDateString('vi-VN')}</td>
                      <td>{new Date(p.last_active_at).toLocaleString('vi-VN')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Người gửi</th>
                  <th>Nội dung lời chúc</th>
                  <th>Thời gian gửi</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {wishes.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: '#8c7654', padding: 24 }}>
                      Chưa có lời chúc nào được gửi.
                    </td>
                  </tr>
                ) : (
                  wishes.map((w) => (
                    <tr key={w.id}>
                      <td><strong>{w.sender_name}</strong></td>
                      <td style={{ maxWidth: 360, wordBreak: 'break-word' }}>{w.content}</td>
                      <td>{new Date(w.created_at).toLocaleString('vi-VN')}</td>
                      <td>
                        <button
                          className="wish-delete-btn"
                          title="Xóa lời chúc"
                          onClick={() => deleteWish(w.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

