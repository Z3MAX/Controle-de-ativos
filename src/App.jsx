const RoomFormModal = ({ 
  showRoomForm, 
  setShowRoomForm, 
  editingRoom, 
  setEditingRoom, 
  roomForm, 
  setRoomForm, 
  handleSaveRoom, 
  isLoading, 
  floors,
  Icons 
}) => {
  if (!showRoomForm) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900/80 via-purple-900/80 to-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl w-full max-w-md shadow-2xl border border-white/20">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-green-800 to-gray-900 bg-clip-text text-transparent">
                {editingRoom ? '✏️ Editar Sala' : '🚪 Nova Sala'}
              </h3>
              <p className="text-gray-600 mt-2 font-medium">
                {editingRoom ? 'Atualize as informações da sala' : 'Adicione uma nova sala ao sistema'}
              </p>
            </div>
            <button
              onClick={() => {
                setShowRoomForm(false);
                setEditingRoom(null);
                setRoomForm({ name: '', description: '', floor_id: '' });
              }}
              className="p-2 hover:bg-gray-100 rounded-2xl transition-colors"
            >
              <Icons.X />
            </button>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">Nome da Sala *</label>
              <input
                type="text"
                value={roomForm.name}
                onChange={(e) => setRoomForm({...roomForm, name: e.target.value})}
                className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-medium"
                placeholder="Ex: Sala de Reuniões A"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">Andar *</label>
              <select
                value={roomForm.floor_id}
                onChange={(e) => setRoomForm({...roomForm, floor_id: e.target.value})}
                className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-medium"
              >
                <option value="">🏢 Selecione um andar</option>
                {floors.map(floor => (
                  <option key={floor.id} value={floor.id}>{floor.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">Descrição</label>
              <textarea
                value={roomForm.description}
                onChange={(e) => setRoomForm({...roomForm, description: e.target.value})}
                rows={4}
                className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-medium resize-none"
                placeholder="Descrição da sala..."
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={() => {
                setShowRoomForm(false);
                setEditingRoom(null);
                setRoomForm({ name: '', description: '', floor_id: '' });
              }}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-2xl hover:bg-gray-50 transition-all font-bold"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveRoom}
              disabled={isLoading}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-400 text-white rounded-2xl transition-all font-bold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:hover:scale-100"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Salvando...</span>
                </div>
              ) : (
                editingRoom ? '✅ Atualizar Sala' : '💾 Salvar Sala'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const FloorFormModal = ({ 
  showFloorForm, 
  setShowFloorForm, 
  editingFloor,
  setEditingFloor,
  floorForm, 
  setFloorForm, 
  handleSaveFloor, 
  isLoading,
  Icons 
}) => {
  if (!showFloorForm) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900/80 via-purple-900/80 to-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl w-full max-w-md shadow-2xl border border-white/20">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-gray-900 bg-clip-text text-transparent">
                {editingFloor ? '✏️ Editar Andar' : '🏢 Novo Andar'}
              </h3>
              <p className="text-gray-600 mt-2 font-medium">
                {editingFloor ? 'Atualize as informações do andar' : 'Adicione um novo andar ao sistema'}
              </p>
            </div>
            <button
              onClick={() => {
                setShowFloorForm(false);
                setEditingFloor(null);
                setFloorForm({ name: '', description: '' });
              }}
              className="p-2 hover:bg-gray-100 rounded-2xl transition-colors"
            >
              <Icons.X />
            </button>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">Nome do Andar *</label>
              <input
                type="text"
                value={floorForm.name}
                onChange={(e) => setFloorForm({...floorForm, name: e.target.value})}
                className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-medium"
                placeholder="Ex: 1º Andar, Térreo, Subsolo"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">Descrição</label>
              <textarea
                value={floorForm.description}
                onChange={(e) => setFloorForm({...floorForm, description: e.target.value})}
                rows={4}
                className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-medium resize-none"
                placeholder="Descrição do andar (opcional)..."
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={() => {
                setShowFloorForm(false);
                setEditingFloor(null);
                setFloorForm({ name: '', description: '' });
              }}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-2xl hover:bg-gray-50 transition-all font-bold"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveFloor}
              disabled={isLoading}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:from-gray-400 disabled:to-gray-400 text-white rounded-2xl transition-all font-bold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:hover:scale-100"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Salvando...</span>
                </div>
              ) : (
                editingFloor ? '✅ Atualizar Andar' : '💾 Salvar Andar'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const AssetDetailModal = ({ 
  showAssetDetail, 
  setShowAssetDetail, 
  handleEditAsset, 
  getFloorName, 
  getRoomName, 
  StatusBadge,
  Icons 
}) => {
  if (!showAssetDetail) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900/80 via-purple-900/80 to-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl w-full max-w-6xl max-h-[95vh] overflow-y-auto shadow-2xl border border-white/20">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-gray-900 bg-clip-text text-transparent">
                🔍 Detalhes do Ativo
              </h3>
              <p className="text-gray-600 mt-2 font-medium">Informações completas do ativo</p>
            </div>
            <button
              onClick={() => setShowAssetDetail(null)}
              className="p-3 hover:bg-gray-100 rounded-2xl transition-colors"
            >
              <Icons.X />
            </button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-6 rounded-2xl border border-blue-100">
                <label className="block text-sm font-bold text-blue-700 mb-2">Nome</label>
                <p className="text-xl font-bold text-blue-900">{showAssetDetail.name}</p>
              </div>
              
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-2xl border border-purple-100">
                <label className="block text-sm font-bold text-purple-700 mb-2">Código</label>
                <p className="text-lg font-mono font-bold text-purple-900 bg-white/70 px-3 py-2 rounded-xl inline-block">
                  {showAssetDetail.code}
                </p>
              </div>
              
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-2xl border border-green-100">
                <label className="block text-sm font-bold text-green-700 mb-3">Categoria</label>
                <span className="inline-block px-4 py-2 bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 rounded-2xl text-sm font-bold border border-green-200">
                  {showAssetDetail.category || 'Sem categoria'}
                </span>
              </div>
              
              <div className="bg-gradient-to-r from-orange-50 to-red-50 p-6 rounded-2xl border border-orange-100">
                <label className="block text-sm font-bold text-orange-700 mb-3">Status</label>
                <StatusBadge status={showAssetDetail.status} />
              </div>
              
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-2xl border border-indigo-100">
                <label className="block text-sm font-bold text-indigo-700 mb-2">Localização</label>
                <div className="flex items-center space-x-2 text-indigo-900">
                  <Icons.MapPin />
                  <p className="font-bold text-lg">
                    {getFloorName(showAssetDetail.floor_id)} {showAssetDetail.room_id ? `- ${getRoomName(showAssetDetail.room_id)}` : '(Sem sala específica)'}
                  </p>
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-6 rounded-2xl border border-yellow-100">
                <label className="block text-sm font-bold text-yellow-700 mb-2">Valor</label>
                <div className="flex items-center space-x-2">
                  <Icons.DollarSign />
                  <p className="text-xl font-bold text-yellow-900">
                    {showAssetDetail.value ? 
                      `R$ ${parseFloat(showAssetDetail.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 
                      'Não informado'
                    }
                  </p>
                </div>
              </div>

              {showAssetDetail.supplier && (
                <div className="bg-gradient-to-r from-teal-50 to-cyan-50 p-6 rounded-2xl border border-teal-100">
                  <label className="block text-sm font-bold text-teal-700 mb-2">Fornecedor</label>
                  <p className="text-lg font-bold text-teal-900">{showAssetDetail.supplier}</p>
                </div>
              )}

              {showAssetDetail.serial_number && (
                <div className="bg-gradient-to-r from-rose-50 to-pink-50 p-6 rounded-2xl border border-rose-100">
                  <label className="block text-sm font-bold text-rose-700 mb-2">Número de Série</label>
                  <p className="text-lg font-mono font-bold text-rose-900 bg-white/70 px-3 py-2 rounded-xl inline-block">
                    {showAssetDetail.serial_number}
                  </p>
                </div>
              )}
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-4">📷 Foto do Ativo</label>
                <div className="w-full h-80 bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl overflow-hidden border-4 border-white shadow-xl">
                  {showAssetDetail.photo ? (
                    <img 
                      src={showAssetDetail.photo} 
                      alt={showAssetDetail.name} 
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <Icons.Camera />
                        </div>
                        <span className="text-gray-600 font-bold">Nenhuma foto disponível</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {showAssetDetail.description && (
                <div className="bg-gradient-to-r from-slate-50 to-gray-50 p-6 rounded-2xl border border-slate-200">
                  <label className="block text-sm font-bold text-slate-700 mb-3">📝 Descrição</label>
                  <p className="text-slate-900 font-medium leading-relaxed">{showAssetDetail.description}</p>
                </div>
              )}

              <div className="bg-gradient-to-r from-gray-50 to-slate-50 p-6 rounded-2xl border border-gray-200">
                <label className="block text-sm font-bold text-gray-700 mb-4">🔧 Informações do Sistema</label>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between p-3 bg-white/80 rounded-xl">
                    <span className="font-bold text-gray-600">Criado em:</span>
                    <span className="font-mono text-gray-900">
                      {new Date(showAssetDetail.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/80 rounded-xl">
                    <span className="font-bold text-gray-600">Última atualização:</span>
                    <span className="font-mono text-gray-900">
                      {new Date(showAssetDetail.updated_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end space-x-4 mt-10 pt-6 border-t border-gray-200">
            <button
              onClick={() => {
                setShowAssetDetail(null);
                handleEditAsset(showAssetDetail);
              }}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-2xl transition-all font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <div className="flex items-center space-x-2">
                <Icons.Edit />
                <span>✏️ Editar Ativo</span>
              </div>
            </button>
            <button
              onClick={() => setShowAssetDetail(null)}
              className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-2xl hover:bg-gray-50 transition-all font-bold"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// =================== COMPONENTE PRINCIPAL ===================
const App = () => {
  const { user, loading, dbReady, connectionError } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-3xl flex items-center justify-center mx-auto mb-6 animate-pulse shadow-2xl">
            <Icons.Package />
          </div>
          <div className="space-y-2">
            <p className="text-gray-800 text-xl font-bold">Conectando ao NeonDB...</p>
            <div className="flex items-center justify-center space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
              <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-red-50 flex items-center justify-center p-4">
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-10 max-w-md w-full shadow-2xl border border-white/20 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-pink-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <Icons.AlertCircle />
          </div>
          <h2 className="text-2xl font-bold text-red-800 mb-4">❌ Erro de Conexão</h2>
          <p className="text-red-600 mb-6 font-medium">{connectionError}</p>
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <p className="text-sm text-red-700 font-medium">
              💡 Verifique se a variável <code className="bg-red-100 px-2 py-1 rounded font-mono">VITE_DATABASE_URL</code> está configurada corretamente.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4 relative overflow-hidden">
          {/* Background Animated Elements */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
          </div>
          
          <div className="max-w-lg w-full relative z-10">
            <div className="text-center mb-12">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl transform hover:scale-110 transition-transform duration-300">
                <Icons.Package />
              </div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent mb-4">
                AssetManager Pro
              </h1>
              <p className="text-gray-700 text-xl font-medium mb-2">Sistema Inteligente de Controle de Ativos</p>
            </div>

            <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-8 text-white">
                <h2 className="text-3xl font-bold text-center mb-4">🚀 Bem-vindo!</h2>
                <p className="text-center text-blue-100 font-medium">
                  Gerencie seus ativos com tecnologia de ponta
                </p>
              </div>
              
              <div className="p-8">
                <div className="grid grid-cols-1 gap-4 mb-8">
                  <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl border border-blue-100">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg">
                      <Icons.CheckCircle />
                    </div>
                    <div>
                      <p className="font-bold text-blue-900">Gestão Completa de Ativos</p>
                      <p className="text-sm text-blue-700">Controle total dos seus equipamentos</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-100">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
                      <Icons.Camera />
                    </div>
                    <div>
                      <p className="font-bold text-green-900">Fotos Inteligentes</p>
                      <p className="text-sm text-green-700">Capture fotos diretamente no sistema</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border border-purple-100">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
                      <Icons.Building />
                    </div>
                    <div>
                      <p className="font-bold text-purple-900">Andares Pré-Configurados</p>
                      <p className="text-sm text-purple-700">5º, 11º e 15º andares já cadastrados</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowAuthModal(true)}
                  className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white py-5 px-8 rounded-2xl font-bold transition-all shadow-xl hover:shadow-2xl transform hover:scale-105 text-lg"
                >
                  🚀 Acessar Sistema
                </button>

                <div className="mt-8 text-center">
                  <div className="flex items-center justify-center space-x-2 text-sm">
                    <Icons.CheckCircle />
                    <span className="text-green-700 font-bold">Conexão com NeonDB estabelecida</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-4">
                    ©1995-2025 Integration Consulting and any of its affiliates. All rights reserved.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </>
    );
  }

  // Usuário logado - mostrar sistema completo
  return <AssetControlSystem />;
};

const AppWithProvider = () => {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
};

export default AppWithProvider;// SISTEMA DE CONTROLE DE ATIVOS COM AUTENTICAÇÃO SEGURA E FEEDBACK MELHORADO
// Substitua o conteúdo do arquivo src/App.jsx por este código:

import React, { useState, useEffect, createContext, useContext, useRef } from 'react';

// =================== CONTEXT DE AUTENTICAÇÃO ===================
const AuthContext = createContext({});

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// =================== UTILITÁRIOS DE CRIPTOGRAFIA ===================
const CryptoUtils = {
  // Gerar hash da senha usando Web Crypto API
  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  },

  // Verificar se a senha corresponde ao hash
  async verifyPassword(password, hash) {
    const passwordHash = await this.hashPassword(password);
    return passwordHash === hash;
  }
};

// =================== SERVIÇOS REAIS DO BANCO COM SENHA ===================
const databaseService = {
  async getConnection() {
    try {
      if (!import.meta.env.VITE_DATABASE_URL) {
        throw new Error('VITE_DATABASE_URL não configurada');
      }
      
      const { neon } = await import('@neondatabase/serverless');
      return neon(import.meta.env.VITE_DATABASE_URL);
    } catch (error) {
      console.error('Erro ao conectar:', error);
      throw error;
    }
  },

  async testConnection() {
    try {
      const sql = await this.getConnection();
      const result = await sql`SELECT NOW() as current_time`;
      console.log('✅ Conexão com NeonDB estabelecida:', result[0].current_time);
      return true;
    } catch (error) {
      console.error('❌ Erro ao conectar com NeonDB:', error);
      return false;
    }
  },

  async initializeDatabase() {
    try {
      const sql = await this.getConnection();

      // Criar tabela de usuários com senha hash e foto
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          company VARCHAR(255),
          photo TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Verificar se existe coluna password_hash (para migração)
      try {
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`;
        console.log('✅ Coluna password_hash adicionada/verificada');
      } catch (error) {
        console.log('ℹ️ Coluna password_hash já existe ou erro na migração:', error);
      }

      // Criar tabela de andares
      await sql`
        CREATE TABLE IF NOT EXISTS floors (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Criar tabela de salas
      await sql`
        CREATE TABLE IF NOT EXISTS rooms (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          floor_id INTEGER REFERENCES floors(id) ON DELETE CASCADE,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Criar tabela de ativos
      await sql`
        CREATE TABLE IF NOT EXISTS assets (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          code VARCHAR(100) NOT NULL,
          category VARCHAR(100),
          description TEXT,
          value DECIMAL(12,2),
          status VARCHAR(50) DEFAULT 'Ativo',
          floor_id INTEGER REFERENCES floors(id),
          room_id INTEGER REFERENCES rooms(id),
          photo TEXT,
          supplier VARCHAR(255),
          serial_number VARCHAR(255),
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(code, user_id)
        )
      `;

      console.log('✅ Banco de dados inicializado com autenticação segura');
      return true;
    } catch (error) {
      console.error('❌ Erro ao inicializar banco:', error);
      return false;
    }
  },

  users: {
    async create(userData) {
      try {
        const sql = await databaseService.getConnection();
        
        // Hash da senha antes de salvar
        const passwordHash = await CryptoUtils.hashPassword(userData.password);
        
        const result = await sql`
          INSERT INTO users (email, name, password_hash, company, photo)
          VALUES (
            ${userData.email}, 
            ${userData.name}, 
            ${passwordHash}, 
            ${userData.company || null}, 
            ${userData.photo || null}
          )
          RETURNING id, email, name, company, photo, created_at, updated_at
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao criar usuário:', error);
        
        if (error.message.includes('unique') || error.message.includes('duplicate')) {
          return { success: false, error: 'Este e-mail já está cadastrado no sistema' };
        }
        
        return { success: false, error: 'Erro interno do servidor. Tente novamente.' };
      }
    },

    async authenticate(email, password) {
      try {
        const sql = await databaseService.getConnection();
        
        // Buscar usuário com senha hash
        const result = await sql`
          SELECT id, email, name, password_hash, company, photo, created_at, updated_at
          FROM users 
          WHERE email = ${email} 
          LIMIT 1
        `;
        
        if (result.length === 0) {
          return { success: false, error: 'E-mail não encontrado. Verifique o endereço digitado.' };
        }
        
        const user = result[0];
        
        // Verificar se a senha está correta
        const isValidPassword = await CryptoUtils.verifyPassword(password, user.password_hash);
        
        if (!isValidPassword) {
          return { success: false, error: 'Senha incorreta. Verifique sua senha e tente novamente.' };
        }
        
        // Retornar usuário sem o hash da senha
        const { password_hash, ...userWithoutPassword } = user;
        return { success: true, data: userWithoutPassword };
        
      } catch (error) {
        console.error('Erro na autenticação:', error);
        return { success: false, error: 'Erro de conexão. Verifique sua internet e tente novamente.' };
      }
    },

    async findByEmail(email) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`
          SELECT id, email, name, company, photo, created_at, updated_at
          FROM users 
          WHERE email = ${email} 
          LIMIT 1
        `;
        return { success: true, data: result[0] || null };
      } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        return { success: false, error: error.message };
      }
    },

    async update(id, updates) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`
          UPDATE users 
          SET name = ${updates.name}, 
              company = ${updates.company || null},
              photo = ${updates.photo || null},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
          RETURNING id, email, name, company, photo, created_at, updated_at
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        return { success: false, error: error.message };
      }
    },

    async updatePassword(id, newPassword) {
      try {
        const sql = await databaseService.getConnection();
        
        // Hash da nova senha
        const passwordHash = await CryptoUtils.hashPassword(newPassword);
        
        const result = await sql`
          UPDATE users 
          SET password_hash = ${passwordHash},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
          RETURNING id, email, name, company, photo, created_at, updated_at
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao atualizar senha:', error);
        return { success: false, error: error.message };
      }
    }
  },

  floors: {
    async getAll(userId) {
      try {
        const sql = await databaseService.getConnection();
        const floors = await sql`
          SELECT * FROM floors WHERE user_id = ${userId} ORDER BY name
        `;
        
        for (let floor of floors) {
          const rooms = await sql`
            SELECT * FROM rooms WHERE floor_id = ${floor.id} ORDER BY name
          `;
          floor.rooms = rooms;
        }
        
        return { success: true, data: floors };
      } catch (error) {
        console.error('Erro ao buscar andares:', error);
        return { success: false, error: error.message };
      }
    },

    async create(floorData, userId) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`
          INSERT INTO floors (name, description, user_id)
          VALUES (${floorData.name}, ${floorData.description || null}, ${userId})
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao criar andar:', error);
        return { success: false, error: error.message };
      }
    },

    async update(id, updates, userId) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`
          UPDATE floors 
          SET name = ${updates.name}, 
              description = ${updates.description || null},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id} AND user_id = ${userId}
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao atualizar andar:', error);
        return { success: false, error: error.message };
      }
    },

    async delete(id, userId) {
      try {
        const sql = await databaseService.getConnection();
        
        const assetsCheck = await sql`
          SELECT COUNT(*) as count FROM assets WHERE floor_id = ${id} AND user_id = ${userId}
        `;
        
        if (parseInt(assetsCheck[0].count) > 0) {
          return { 
            success: false, 
            error: 'Não é possível excluir o andar pois existem ativos vinculados a ele' 
          };
        }

        await sql`
          DELETE FROM floors WHERE id = ${id} AND user_id = ${userId}
        `;
        return { success: true };
      } catch (error) {
        console.error('Erro ao deletar andar:', error);
        return { success: false, error: error.message };
      }
    },

    async getByName(name, userId) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`
          SELECT * FROM floors 
          WHERE LOWER(name) LIKE LOWER(${`%${name}%`}) AND user_id = ${userId}
          LIMIT 1
        `;
        return { success: true, data: result[0] || null };
      } catch (error) {
        console.error('Erro ao buscar andar por nome:', error);
        return { success: false, error: error.message };
      }
    }
  },

  rooms: {
    async create(roomData, userId) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`
          INSERT INTO rooms (name, description, floor_id, user_id)
          VALUES (${roomData.name}, ${roomData.description || null}, ${roomData.floor_id}, ${userId})
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao criar sala:', error);
        return { success: false, error: error.message };
      }
    },

    async update(id, updates, userId) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`
          UPDATE rooms 
          SET name = ${updates.name}, 
              description = ${updates.description || null},
              floor_id = ${updates.floor_id},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id} AND user_id = ${userId}
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao atualizar sala:', error);
        return { success: false, error: error.message };
      }
    },

    async delete(id, userId) {
      try {
        const sql = await databaseService.getConnection();
        
        const assetsCheck = await sql`
          SELECT COUNT(*) as count FROM assets WHERE room_id = ${id} AND user_id = ${userId}
        `;
        
        if (parseInt(assetsCheck[0].count) > 0) {
          return { 
            success: false, 
            error: 'Não é possível excluir a sala pois existem ativos vinculados a ela' 
          };
        }

        await sql`
          DELETE FROM rooms WHERE id = ${id} AND user_id = ${userId}
        `;
        return { success: true };
      } catch (error) {
        console.error('Erro ao deletar sala:', error);
        return { success: false, error: error.message };
      }
    }
  },

  assets: {
    async getAll(userId) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`
          SELECT * FROM assets WHERE user_id = ${userId} ORDER BY created_at DESC
        `;
        return { success: true, data: result };
      } catch (error) {
        console.error('Erro ao buscar ativos:', error);
        return { success: false, error: error.message };
      }
    },

    async create(assetData, userId) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`
          INSERT INTO assets (
            name, code, category, description, value, status, 
            floor_id, room_id, photo, supplier, serial_number, user_id
          )
          VALUES (
            ${assetData.name}, ${assetData.code}, ${assetData.category || null},
            ${assetData.description || null}, ${assetData.value || null}, ${assetData.status},
            ${assetData.floor_id}, ${assetData.room_id || null}, ${assetData.photo || null},
            ${assetData.supplier || null}, ${assetData.serial_number || null}, ${userId}
          )
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao criar ativo:', error);
        return { success: false, error: error.message };
      }
    },

    async update(id, updates, userId) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`
          UPDATE assets 
          SET name = ${updates.name}, 
              code = ${updates.code},
              category = ${updates.category || null},
              description = ${updates.description || null},
              value = ${updates.value || null},
              status = ${updates.status},
              floor_id = ${updates.floor_id},
              room_id = ${updates.room_id || null},
              photo = ${updates.photo || null},
              supplier = ${updates.supplier || null},
              serial_number = ${updates.serial_number || null},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id} AND user_id = ${userId}
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao atualizar ativo:', error);
        return { success: false, error: error.message };
      }
    },

    async delete(id, userId) {
      try {
        const sql = await databaseService.getConnection();
        await sql`
          DELETE FROM assets WHERE id = ${id} AND user_id = ${userId}
        `;
        return { success: true };
      } catch (error) {
        console.error('Erro ao deletar ativo:', error);
        return { success: false, error: error.message };
      }
    }
  }
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dbReady, setDbReady] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  // ============= FUNÇÃO PARA CRIAR ANDARES PADRÃO =============
  const createDefaultFloors = async (userId) => {
    try {
      console.log('🏢 Verificando andares padrão para usuário:', userId);
      
      const existingFloors = await databaseService.floors.getAll(userId);
      if (!existingFloors.success) {
        console.error('Erro ao buscar andares existentes');
        return;
      }

      const floorNames = existingFloors.data.map(floor => floor.name.toLowerCase());
      
      const defaultFloors = [
        {
          name: '5º Andar',
          description: 'Quinto andar - Administrativo e Financeiro'
        },
        {
          name: '11º Andar', 
          description: 'Décimo primeiro andar - Tecnologia e Inovação'
        },
        {
          name: '15º Andar',
          description: 'Décimo quinto andar - Diretoria Executiva'
        }
      ];

      for (const floorData of defaultFloors) {
        const floorExists = floorNames.some(name => 
          name.includes('5') && floorData.name.includes('5') ||
          name.includes('11') && floorData.name.includes('11') ||
          name.includes('15') && floorData.name.includes('15')
        );

        if (!floorExists) {
          console.log(`🏢 Criando andar padrão: ${floorData.name}`);
          const result = await databaseService.floors.create(floorData, userId);
          
          if (result.success) {
            console.log(`✅ Andar "${floorData.name}" criado com sucesso`);
            await createDefaultRooms(result.data.id, userId, floorData.name);
          } else {
            console.error(`❌ Erro ao criar andar "${floorData.name}":`, result.error);
          }
        } else {
          console.log(`ℹ️ Andar "${floorData.name}" já existe`);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao criar andares padrão:', error);
    }
  };

  // ============= FUNÇÃO PARA CRIAR SALAS PADRÃO =============
  const createDefaultRooms = async (floorId, userId, floorName) => {
    try {
      let defaultRooms = [];
      
      if (floorName.includes('5')) {
        defaultRooms = [
          { name: 'Sala de Reuniões 501', description: 'Sala de reuniões principal' },
          { name: 'Departamento Financeiro', description: 'Setor financeiro e contábil' },
          { name: 'Recursos Humanos', description: 'Departamento de RH' }
        ];
      } else if (floorName.includes('11')) {
        defaultRooms = [
          { name: 'Sala de Desenvolvimento', description: 'Equipe de desenvolvimento de software' },
          { name: 'Laboratório de Testes', description: 'Ambiente para testes e homologação' },
          { name: 'Sala de Inovação', description: 'Espaço para brainstorming e inovação' }
        ];
      } else if (floorName.includes('15')) {
        defaultRooms = [
          { name: 'Sala da Diretoria', description: 'Sala do conselho executivo' },
          { name: 'Sala de Reuniões Executiva', description: 'Reuniões de alta gestão' },
          { name: 'Secretaria Executiva', description: 'Suporte à diretoria' }
        ];
      }

      for (const roomData of defaultRooms) {
        const roomResult = await databaseService.rooms.create({
          ...roomData,
          floor_id: floorId
        }, userId);
        
        if (roomResult.success) {
          console.log(`✅ Sala "${roomData.name}" criada no ${floorName}`);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao criar salas padrão:', error);
    }
  };

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const isConnected = await databaseService.testConnection();
        if (!isConnected) {
          setConnectionError('Falha na conexão com banco de dados NeonDB');
          setLoading(false);
          return;
        }

        const dbInit = await databaseService.initializeDatabase();
        if (!dbInit) {
          setConnectionError('Falha ao inicializar estrutura do banco');
          setLoading(false);
          return;
        }

        setDbReady(true);
        setConnectionError(null);

        const savedUser = localStorage.getItem('asset_manager_user');
        if (savedUser) {
          try {
            const userData = JSON.parse(savedUser);
            const userCheck = await databaseService.users.findByEmail(userData.email);
            if (userCheck.success && userCheck.data) {
              setUser(userCheck.data);
              setProfile(userCheck.data);
              
              await createDefaultFloors(userCheck.data.id);
            } else {
              localStorage.removeItem('asset_manager_user');
            }
          } catch (error) {
            console.error('Erro ao validar usuário salvo:', error);
            localStorage.removeItem('asset_manager_user');
          }
        }
      } catch (error) {
        console.error('Erro ao inicializar aplicação:', error);
        setConnectionError('Erro ao conectar com banco de dados');
      } finally {
        setLoading(false);
      }
    };

    initializeApp();
  }, []);

  const signUp = async (email, password, name, company = '', photo = null) => {
    if (!dbReady) {
      return { success: false, error: 'Banco de dados não disponível' };
    }

    try {
      setLoading(true);
      
      // Validações básicas
      if (!email || !password || !name) {
        return { success: false, error: 'E-mail, senha e nome são obrigatórios' };
      }
      
      if (password.length < 6) {
        return { success: false, error: 'A senha deve ter pelo menos 6 caracteres' };
      }

      // Validação de e-mail
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return { success: false, error: 'E-mail inválido. Por favor, digite um e-mail válido' };
      }
      
      const result = await databaseService.users.create({
        email,
        password,
        name,
        company,
        photo
      });

      if (result.success) {
        const userData = result.data;
        setUser(userData);
        setProfile(userData);
        localStorage.setItem('asset_manager_user', JSON.stringify(userData));
        
        await createDefaultFloors(userData.id);
        
        return { success: true, data: { user: userData } };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Erro no registro:', error);
      return { success: false, error: 'Erro interno. Tente novamente mais tarde.' };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    if (!dbReady) {
      return { success: false, error: 'Banco de dados não disponível' };
    }

    try {
      setLoading(true);
      
      // Validações básicas
      if (!email || !password) {
        return { success: false, error: 'Por favor, preencha e-mail e senha' };
      }

      // Validação de formato de e-mail
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return { success: false, error: 'Formato de e-mail inválido' };
      }
      
      const result = await databaseService.users.authenticate(email.trim().toLowerCase(), password);
      
      if (result.success) {
        const userData = result.data;
        setUser(userData);
        setProfile(userData);
        localStorage.setItem('asset_manager_user', JSON.stringify(userData));
        
        await createDefaultFloors(userData.id);
        
        return { success: true, data: { user: userData } };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Erro no login:', error);
      return { success: false, error: 'Erro de conexão. Verifique sua internet e tente novamente.' };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      setUser(null);
      setProfile(null);
      localStorage.removeItem('asset_manager_user');
      return { success: true };
    } catch (error) {
      console.error('Erro no logout:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates) => {
    if (!user) return { success: false, error: 'Usuário não logado' };

    try {
      setLoading(true);
      const result = await databaseService.users.update(user.id, updates);
      
      if (result.success) {
        const updatedUser = result.data;
        setUser(updatedUser);
        setProfile(updatedUser);
        localStorage.setItem('asset_manager_user', JSON.stringify(updatedUser));
        
        return { success: true, data: updatedUser };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (newPassword) => {
    if (!user) return { success: false, error: 'Usuário não logado' };

    try {
      setLoading(true);
      
      if (newPassword.length < 6) {
        return { success: false, error: 'A senha deve ter pelo menos 6 caracteres' };
      }
      
      const result = await databaseService.users.updatePassword(user.id, newPassword);
      
      if (result.success) {
        return { success: true, message: 'Senha alterada com sucesso' };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    profile,
    loading,
    dbReady,
    connectionError,
    signUp,
    signIn,
    signOut,
    updateProfile,
    changePassword
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// =================== ÍCONES MODERNOS ===================
const Icons = {
  User: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  Package: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  Camera: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Upload: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  ),
  Image: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  X: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Edit: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  Check: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  AlertCircle: () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  ),
  CheckCircle: () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Plus: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  ),
  Building: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  BarChart3: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  Eye: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ),
  Trash2: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  MapPin: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  DollarSign: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <line x1="12" y1="1" x2="12" y2="23"></line>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
    </svg>
  ),
  Sparkles: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l1.5 1.5L5 6L3.5 4.5L5 3zM19 3l1.5 1.5L19 6l-1.5-1.5L19 3zM12 12l3-3 3 3-3 3-3-3zM5 21l1.5-1.5L5 18l-1.5 1.5L5 21zM19 21l1.5-1.5L19 18l-1.5 1.5L19 21z" />
    </svg>
  ),
  RotateCcw: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <polyline points="1 4 1 10 7 10"></polyline>
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
    </svg>
  ),
  Settings: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  ),
  Key: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  ),
  EyeOff: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
    </svg>
  )
};

// =================== MODAL DE AUTENTICAÇÃO MELHORADO ===================
const AuthModal = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' ou 'error'
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [userPhoto, setUserPhoto] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, signUp, dbReady } = useAuth();
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    company: ''
  });

  // Função para limpar mensagens após um tempo
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 5000); // Remove a mensagem após 5 segundos

      return () => clearTimeout(timer);
    }
  }, [message]);

  const PhotoUtils = {
    fileToBase64: (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
      });
    },

    resizeImage: (file, maxWidth = 800, maxHeight = 600, quality = 0.8) => {
      return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
          let { width, height } = img;
          
          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          
          const base64 = canvas.toDataURL('image/jpeg', quality);
          resolve(base64);
        };
        
        img.src = URL.createObjectURL(file);
      });
    },

    captureFromCamera: () => {
      return new Promise((resolve, reject) => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          reject(new Error('Câmera não suportada neste navegador'));
          return;
        }

        navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          } 
        })
          .then(stream => {
            const video = document.createElement('video');
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            video.srcObject = stream;
            video.autoplay = true;
            video.muted = true;
            
            video.onloadedmetadata = () => {
              setTimeout(() => {
                try {
                  canvas.width = video.videoWidth;
                  canvas.height = video.videoHeight;
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  
                  stream.getTracks().forEach(track => {
                    track.stop();
                  });
                  
                  const base64 = canvas.toDataURL('image/jpeg', 0.8);
                  resolve(base64);
                } catch (error) {
                  stream.getTracks().forEach(track => track.stop());
                  reject(new Error('Erro ao capturar foto: ' + error.message));
                }
              }, 500);
            };
            
            video.onerror = (error) => {
              stream.getTracks().forEach(track => track.stop());
              reject(new Error('Erro no vídeo: ' + error.message));
            };
          })
          .catch(error => {
            console.error('Erro ao acessar câmera:', error);
            reject(new Error('Não foi possível acessar a câmera. Verifique as permissões.'));
          });
      });
    }
  };

  const showMessage = (text, type = 'error') => {
    setMessage(text);
    setMessageType(type);
  };

  const handlePhotoCapture = async () => {
    try {
      const photo = await PhotoUtils.captureFromCamera();
      setUserPhoto(photo);
      setShowPhotoOptions(false);
      showMessage('Foto capturada com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao capturar foto:', error);
      showMessage('Erro ao acessar câmera: ' + error.message, 'error');
    }
  };

  const handlePhotoGallery = () => {
    fileInputRef.current?.click();
    setShowPhotoOptions(false);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const resizedPhoto = await PhotoUtils.resizeImage(file, 400, 400, 0.8);
        setUserPhoto(resizedPhoto);
        showMessage('Foto selecionada com sucesso!', 'success');
      } catch (error) {
        console.error('Erro ao processar foto:', error);
        showMessage('Erro ao processar foto: ' + error.message, 'error');
      }
    }
  };

  const resetForm = () => {
    setFormData({ email: '', password: '', name: '', company: '' });
    setUserPhoto(null);
    setMessage('');
    setMessageType('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!dbReady) {
      showMessage('Banco de dados não está disponível. Tente novamente.', 'error');
      return;
    }

    // Limpar mensagens anteriores
    setMessage('');
    setMessageType('');
    setLoading(true);

    try {
      let result;
      
      if (isLogin) {
        result = await signIn(formData.email, formData.password);
      } else {
        result = await signUp(formData.email, formData.password, formData.name, formData.company, userPhoto);
      }

      if (result.success) {
        showMessage(isLogin ? 'Login realizado com sucesso!' : 'Conta criada com sucesso!', 'success');
        setTimeout(() => {
          onClose();
          resetForm();
        }, 1500);
      } else {
        showMessage(result.error, 'error');
      }
    } catch (error) {
      console.error('Erro na autenticação:', error);
      showMessage('Erro interno. Tente novamente mais tarde.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    resetForm();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-gradient-to-br from-black/60 via-purple-900/60 to-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full shadow-2xl border border-white/20 max-h-[95vh] overflow-y-auto">
          <button
            onClick={() => {
              onClose();
              resetForm();
            }}
            className="absolute top-4 right-4 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center"
          >
            <Icons.X />
          </button>

          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Icons.User />
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-gray-900 bg-clip-text text-transparent">
              {isLogin ? '🔐 Entrar no Sistema' : '🚀 Criar Nova Conta'}
            </h2>
            <p className="text-gray-600 mt-2">
              {isLogin ? 'Acesse sua conta com segurança' : 'Cadastre-se e gerencie seus ativos'}
            </p>
            {!isLogin && (
              <div className="mt-3 p-3 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700 font-medium flex items-center justify-center">
                  <Icons.CheckCircle />
                  <span className="ml-2">🔐 Sua senha será criptografada com SHA-256</span>
                </p>
              </div>
            )}
          </div>

          {!dbReady && (
            <div className="p-4 bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl mb-6">
              <div className="flex items-center space-x-3">
                <Icons.AlertCircle />
                <div>
                  <p className="text-red-800 text-sm font-bold">Banco de dados não disponível</p>
                  <p className="text-red-600 text-xs">Verifique sua conexão e tente novamente</p>
                </div>
              </div>
            </div>
          )}

          {/* Mensagens de Feedback Melhoradas */}
          {message && (
            <div className={`p-4 rounded-xl mb-6 text-sm font-medium transition-all duration-300 ${
              messageType === 'success' 
                ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-800 border border-green-200' 
                : 'bg-gradient-to-r from-red-50 to-pink-50 text-red-800 border border-red-200'
            }`}>
              <div className="flex items-center space-x-3">
                {messageType === 'success' ? <Icons.CheckCircle /> : <Icons.AlertCircle />}
                <div>
                  <p className="font-bold">
                    {messageType === 'success' ? '✅ Sucesso!' : '❌ Erro'}
                  </p>
                  <p>{message}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="text-center mb-6">
                  <label className="block text-sm font-bold text-gray-700 mb-3">
                    📷 Foto do Perfil (opcional)
                  </label>
                  
                  {userPhoto ? (
                    <div className="relative inline-block">
                      <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-xl">
                        <img 
                          src={userPhoto} 
                          alt="Foto do usuário" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPhotoOptions(true)}
                        className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
                      >
                        <Icons.Edit />
                      </button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => setShowPhotoOptions(true)}
                      className="w-24 h-24 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto cursor-pointer hover:from-gray-300 hover:to-gray-400 transition-all border-4 border-dashed border-gray-400 hover:border-blue-400"
                    >
                      <Icons.Camera />
                    </div>
                  )}
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    minLength="2"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Seu nome completo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Empresa (opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({...formData, company: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Nome da empresa"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                E-mail *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value.toLowerCase()})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="seu@email.com"
              />
            </div>

            <div className="relative">
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Senha *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength="6"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <Icons.EyeOff /> : <Icons.Eye />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1 flex items-center">
                <Icons.Key />
                <span className="ml-1">
                  {isLogin ? 'Digite sua senha de acesso' : 'Será criptografada com SHA-256'}
                </span>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !dbReady}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 text-white py-3 px-6 rounded-lg font-medium transition-all shadow-lg hover:shadow-xl transform hover:scale-105 disabled:hover:scale-100"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                  {isLogin ? 'Entrando...' : 'Criando conta...'}
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  {isLogin ? <Icons.CheckCircle /> : <Icons.User />}
                  <span>{isLogin ? '🔐 Entrar' : '🚀 Criar Conta'}</span>
                </div>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={switchMode}
              disabled={loading}
              className="text-blue-600 hover:text-blue-700 font-medium transition-colors disabled:opacity-50"
            >
              {isLogin ? (
                <span>Não tem conta? <strong>Criar agora →</strong></span>
              ) : (
                <span>Já tem conta? <strong>← Fazer login</strong></span>
              )}
            </button>
          </div>

          {/* Dicas de Segurança */}
          <div className="mt-6 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-700 font-medium text-center">
              🛡️ Seus dados são protegidos com criptografia SHA-256
            </p>
          </div>
        </div>
      </div>

      {/* Modal de opções de foto */}
      {showPhotoOptions && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-white/20 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">📷 Adicionar Foto</h3>
                  <p className="text-blue-100 text-sm mt-1">Escolha uma opção</p>
                </div>
                <button
                  onClick={() => setShowPhotoOptions(false)}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                >
                  <Icons.X />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <button
                onClick={handlePhotoCapture}
                className="w-full bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white p-4 rounded-2xl flex items-center space-x-3 transition-all transform hover:scale-105 shadow-lg"
              >
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Icons.Camera />
                </div>
                <div className="text-left">
                  <p className="font-bold">Tirar Foto</p>
                  <p className="text-sm text-emerald-100">Usar câmera do dispositivo</p>
                </div>
              </button>
              
              <button
                onClick={handlePhotoGallery}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white p-4 rounded-2xl flex items-center space-x-3 transition-all transform hover:scale-105 shadow-lg"
              >
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Icons.Image />
                </div>
                <div className="text-left">
                  <p className="font-bold">Escolher da Galeria</p>
                  <p className="text-sm text-blue-100">Selecionar foto existente</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// =================== UTILITÁRIOS PARA FOTOS ===================
const PhotoUtils = {
  // Converter file para base64
  fileToBase64: (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  },

  // Redimensionar imagem
  resizeImage: (file, maxWidth = 800, maxHeight = 600, quality = 0.8) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calcular novas dimensões mantendo proporção
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Desenhar imagem redimensionada
        ctx.drawImage(img, 0, 0, width, height);
        
        // Converter para base64
        const base64 = canvas.toDataURL('image/jpeg', quality);
        resolve(base64);
      };
      
      img.src = URL.createObjectURL(file);
    });
  },

  // Capturar foto da câmera
  captureFromCamera: () => {
    return new Promise((resolve, reject) => {
      // Verificar se o navegador suporta getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        reject(new Error('Câmera não suportada neste navegador'));
        return;
      }

      navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user' // Câmera frontal
        } 
      })
        .then(stream => {
          // Criar elementos de vídeo e canvas
          const video = document.createElement('video');
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          video.srcObject = stream;
          video.autoplay = true;
          video.muted = true;
          
          video.onloadedmetadata = () => {
            // Aguardar o vídeo carregar completamente
            setTimeout(() => {
              try {
                // Definir dimensões do canvas
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                
                // Capturar frame atual do vídeo
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                // Parar todos os tracks da stream
                stream.getTracks().forEach(track => {
                  track.stop();
                });
                
                // Converter para base64
                const base64 = canvas.toDataURL('image/jpeg', 0.8);
                resolve(base64);
              } catch (error) {
                // Parar stream em caso de erro
                stream.getTracks().forEach(track => track.stop());
                reject(new Error('Erro ao capturar foto: ' + error.message));
              }
            }, 500); // Aguardar 500ms para garantir que o vídeo esteja pronto
          };
          
          video.onerror = (error) => {
            stream.getTracks().forEach(track => track.stop());
            reject(new Error('Erro no vídeo: ' + error.message));
          };
        })
        .catch(error => {
          console.error('Erro ao acessar câmera:', error);
          reject(new Error('Não foi possível acessar a câmera. Verifique as permissões.'));
        });
    });
  }
};

// =================== MODAL DE OPÇÕES DE FOTO ===================
const PhotoOptionsModal = ({ isOpen, onClose, onCameraSelect, onGallerySelect }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-white/20 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold">📷 Adicionar Foto</h3>
              <p className="text-blue-100 text-sm mt-1">Escolha uma opção</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-xl transition-colors"
            >
              <Icons.X />
            </button>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          <button
            onClick={onCameraSelect}
            className="w-full bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white p-4 rounded-2xl flex items-center space-x-3 transition-all transform hover:scale-105 shadow-lg"
          >
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Icons.Camera />
            </div>
            <div className="text-left">
              <p className="font-bold">Tirar Foto</p>
              <p className="text-sm text-emerald-100">Usar câmera do dispositivo</p>
            </div>
          </button>
          
          <button
            onClick={onGallerySelect}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white p-4 rounded-2xl flex items-center space-x-3 transition-all transform hover:scale-105 shadow-lg"
          >
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Icons.Image />
            </div>
            <div className="text-left">
              <p className="font-bold">Escolher da Galeria</p>
              <p className="text-sm text-blue-100">Selecionar foto existente</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

// =================== COMPONENTE DE BADGE DE STATUS ===================
const StatusBadge = ({ status }) => {
  const statusConfig = {
    'Ativo': { bg: 'from-green-100 to-emerald-100', text: 'text-green-800', border: 'border-green-200', icon: '✅' },
    'Inativo': { bg: 'from-gray-100 to-slate-100', text: 'text-gray-800', border: 'border-gray-200', icon: '⏸️' },
    'Manutenção': { bg: 'from-yellow-100 to-orange-100', text: 'text-yellow-800', border: 'border-yellow-200', icon: '🔧' },
    'Descartado': { bg: 'from-red-100 to-pink-100', text: 'text-red-800', border: 'border-red-200', icon: '🗑️' }
  };

  const config = statusConfig[status] || statusConfig['Ativo'];

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-gradient-to-r ${config.bg} ${config.text} border ${config.border}`}>
      <span className="mr-1">{config.icon}</span>
      {status}
    </span>
  );
};

// =================== PÁGINA DE PERFIL ===================
const ProfilePage = () => {
  const { user, updateProfile, changePassword, loading: authLoading } = useAuth();
  const [editMode, setEditMode] = useState(false);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    company: user?.company || '',
    photo: user?.photo || null
  });
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const fileInputRef = useRef(null);

  // Sincronizar formData com dados do usuário
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        company: user.company || '',
        photo: user.photo || null
      });
    }
  }, [user]);

  // Auto-remover mensagens
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const showMessage = (text, type = 'error') => {
    setMessage(text);
    setMessageType(type);
  };

  const handlePhotoCapture = async () => {
    try {
      const photo = await PhotoUtils.captureFromCamera();
      console.log('Foto capturada, tamanho:', photo.length);
      setFormData(prev => ({ ...prev, photo }));
      setShowPhotoOptions(false);
      showMessage('Foto capturada com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao capturar foto:', error);
      showMessage('Erro ao acessar câmera: ' + error.message, 'error');
    }
  };

  const handlePhotoGallery = () => {
    fileInputRef.current?.click();
    setShowPhotoOptions(false);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        console.log('Arquivo selecionado:', file.name, 'Tamanho:', file.size);
        const resizedPhoto = await PhotoUtils.resizeImage(file, 400, 400, 0.8);
        console.log('Foto redimensionada, tamanho:', resizedPhoto.length);
        setFormData(prev => ({ ...prev, photo: resizedPhoto }));
        showMessage('Foto selecionada com sucesso!', 'success');
      } catch (error) {
        console.error('Erro ao processar foto:', error);
        showMessage('Erro ao processar foto: ' + error.message, 'error');
      }
    }
  };

  const handleSave = async () => {
    try {
      setLocalLoading(true);
      
      console.log('Dados a serem salvos:', formData);
      
      const result = await updateProfile(formData);
      if (result.success) {
        showMessage('Perfil atualizado com sucesso!', 'success');
        setEditMode(false);
      } else {
        showMessage(result.error, 'error');
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      showMessage('Erro ao atualizar perfil: ' + error.message, 'error');
    } finally {
      setLocalLoading(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      setLocalLoading(true);
      
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        showMessage('As senhas não coincidem', 'error');
        return;
      }
      
      if (passwordData.newPassword.length < 6) {
        showMessage('A senha deve ter pelo menos 6 caracteres', 'error');
        return;
      }
      
      const result = await changePassword(passwordData.newPassword);
      if (result.success) {
        showMessage('Senha alterada com sucesso!', 'success');
        setShowChangePassword(false);
        setPasswordData({ newPassword: '', confirmPassword: '' });
      } else {
        showMessage(result.error, 'error');
      }
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      showMessage('Erro ao alterar senha: ' + error.message, 'error');
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
          {/* Header do Perfil */}
          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 px-8 py-12 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row items-center space-y-6 md:space-y-0 md:space-x-8">
                <div className="relative">
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-2xl bg-white/20">
                    {(editMode ? formData.photo : user?.photo) ? (
                      <img 
                        src={editMode ? formData.photo : user.photo} 
                        alt="Foto do perfil" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/30 to-white/10">
                        <Icons.User />
                      </div>
                    )}
                  </div>
                  
                  {editMode && (
                    <button
                      onClick={() => setShowPhotoOptions(true)}
                      className="absolute -bottom-2 -right-2 w-10 h-10 bg-white text-blue-600 rounded-full flex items-center justify-center shadow-lg hover:bg-gray-50 transition-colors"
                    >
                      <Icons.Camera />
                    </button>
                  )}
                </div>
                
                <div className="text-center md:text-left flex-1">
                  <h1 className="text-3xl font-bold mb-2">{user?.name}</h1>
                  <p className="text-blue-100 text-lg mb-1">{user?.email}</p>
                  {user?.company && (
                    <p className="text-blue-200 font-medium">{user.company}</p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2 justify-center md:justify-start">
                    <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                      👤 Usuário Ativo
                    </span>
                    <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                      📅 Desde {new Date(user?.created_at).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="px-3 py-1 bg-green-400/20 rounded-full text-sm font-medium">
                      🔒 Login Seguro
                    </span>
                  </div>
                </div>
                
                <div className="flex flex-col space-y-3">
                  {!editMode ? (
                    <>
                      <button
                        onClick={() => setEditMode(true)}
                        className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-xl flex items-center space-x-2 transition-colors font-medium"
                      >
                        <Icons.Edit />
                        <span>Editar Perfil</span>
                      </button>
                      <button
                        onClick={() => setShowChangePassword(true)}
                        className="bg-green-500/20 hover:bg-green-500/30 text-white px-6 py-3 rounded-xl flex items-center space-x-2 transition-colors font-medium"
                      >
                        <Icons.Key />
                        <span>Alterar Senha</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditMode(false);
                          setFormData({
                            name: user?.name || '',
                            company: user?.company || '',
                            photo: user?.photo || null
                          });
                        }}
                        className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-xl transition-colors font-medium"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={localLoading || authLoading}
                        className="bg-white text-blue-600 hover:bg-gray-50 px-6 py-3 rounded-xl flex items-center space-x-2 transition-colors font-medium disabled:opacity-50"
                      >
                        {localLoading || authLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin"></div>
                            <span>Salvando...</span>
                          </>
                        ) : (
                          <>
                            <Icons.Check />
                            <span>Salvar</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Conteúdo do Perfil */}
          <div className="p-8">
            {/* Mensagens de Feedback */}
            {message && (
              <div className={`p-4 rounded-xl mb-6 text-sm font-medium transition-all duration-300 ${
                messageType === 'success' 
                  ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-800 border border-green-200' 
                  : 'bg-gradient-to-r from-red-50 to-pink-50 text-red-800 border border-red-200'
              }`}>
                <div className="flex items-center space-x-3">
                  {messageType === 'success' ? <Icons.CheckCircle /> : <Icons.AlertCircle />}
                  <div>
                    <p className="font-bold">
                      {messageType === 'success' ? '✅ Sucesso!' : '❌ Erro'}
                    </p>
                    <p>{message}</p>
                  </div>
                </div>
              </div>
            )}

            {editMode ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">Nome Completo</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-medium"
                    placeholder="Seu nome completo"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">Empresa</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-medium"
                    placeholder="Nome da empresa (opcional)"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-2xl border border-blue-100">
                  <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center">
                    <Icons.User />
                    <span className="ml-2">Informações Pessoais</span>
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-blue-700">Nome:</label>
                      <p className="text-blue-900 font-bold">{user?.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-blue-700">E-mail:</label>
                      <p className="text-blue-900 font-mono">{user?.email}</p>
                    </div>
                    {user?.company && (
                      <div>
                        <label className="text-sm font-medium text-blue-700">Empresa:</label>
                        <p className="text-blue-900 font-bold">{user.company}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-2xl border border-green-100">
                  <h3 className="text-lg font-bold text-green-900 mb-4 flex items-center">
                    <Icons.Settings />
                    <span className="ml-2">Informações da Conta</span>
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-green-700">Criada em:</label>
                      <p className="text-green-900 font-bold">
                        {new Date(user?.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-green-700">Última atualização:</label>
                      <p className="text-green-900 font-bold">
                        {new Date(user?.updated_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-green-700">Status:</label>
                      <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-bold">
                        ✅ Ativo
                      </span>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-green-700">Segurança:</label>
                      <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-bold">
                        🔒 SHA-256
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Alteração de Senha */}
      {showChangePassword && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-white/20">
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 flex items-center">
                    <Icons.Key />
                    <span className="ml-2">🔒 Alterar Senha</span>
                  </h3>
                  <p className="text-gray-600 mt-2">Digite sua nova senha</p>
                </div>
                <button
                  onClick={() => {
                    setShowChangePassword(false);
                    setPasswordData({ newPassword: '', confirmPassword: '' });
                    setMessage('');
                    setMessageType('');
                  }}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <Icons.X />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Nova Senha</label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Mínimo 6 caracteres"
                    minLength="6"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Confirmar Nova Senha</label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Digite novamente"
                  />
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700 font-medium">
                    🔐 A nova senha será criptografada com SHA-256
                  </p>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowChangePassword(false);
                    setPasswordData({ newPassword: '', confirmPassword: '' });
                    setMessage('');
                    setMessageType('');
                  }}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-bold"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={localLoading || !passwordData.newPassword || !passwordData.confirmPassword}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-400 text-white rounded-lg transition-all font-bold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:hover:scale-100"
                >
                  {localLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                      <span>Alterando...</span>
                    </div>
                  ) : (
                    '🔒 Alterar Senha'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <PhotoOptionsModal
        isOpen={showPhotoOptions}
        onClose={() => setShowPhotoOptions(false)}
        onCameraSelect={handlePhotoCapture}
        onGallerySelect={handlePhotoGallery}
      />
    </>
  );
};
