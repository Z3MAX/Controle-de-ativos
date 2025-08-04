import React from 'react';

// Adicione estes modais no final do seu App.jsx, antes do </div> de fechamento

export const PhotoModals = ({ 
  photoState, 
  closeAllPhotoModals, 
  confirmPhoto, 
  retakePhoto, 
  Icons 
}) => (
  <>
    {/* Modal de Preview da Foto */}
    {photoState.showPreview && photoState.capturedPhoto && (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900/90 via-purple-900/90 to-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20">
          <div className="p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900">🖼️ Preview da Foto</h3>
              <button
                onClick={closeAllPhotoModals}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <Icons.X />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="w-full bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl overflow-hidden border-4 border-white shadow-xl">
                <img 
                  src={photoState.capturedPhoto} 
                  alt="Foto capturada" 
                  className="w-full h-auto max-h-80 object-contain"
                />
              </div>
              
              <div className="flex flex-col space-y-4">
                <button
                  onClick={confirmPhoto}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-5 rounded-2xl flex items-center justify-center space-x-3 transition-all transform hover:scale-105 shadow-lg font-bold"
                >
                  <Icons.Check />
                  <span>✅ Usar Esta Foto</span>
                </button>
                
                <button
                  onClick={retakePhoto}
                  className="w-full bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white px-6 py-4 rounded-2xl flex items-center justify-center space-x-3 transition-all font-bold"
                >
                  <Icons.RotateCcw />
                  <span>🔄 Tirar Outra Foto</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Loading de Processamento */}
    {photoState.isProcessing && (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900/80 via-purple-900/80 to-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[9999]">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-10 text-center shadow-2xl border border-white/20">
          <div className="w-20 h-20 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-6"></div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">🔄 Processando Foto</h3>
          <p className="text-gray-600 font-medium">Aguarde um momento...</p>
          <div className="mt-4 flex items-center justify-center space-x-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
          </div>
        </div>
      </div>
    )}

    {/* Erro de Foto */}
    {photoState.error && (
      <div className="fixed top-6 right-6 bg-gradient-to-r from-red-500 to-pink-500 text-white p-6 rounded-2xl shadow-2xl z-[9999] max-w-sm border border-red-400">
        <div className="flex items-start space-x-3">
          <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
            <Icons.AlertCircle />
          </div>
          <div className="flex-1">
            <p className="font-bold text-lg">❌ Erro na Foto</p>
            <p className="text-sm opacity-90">{photoState.error}</p>
          </div>
          <button
            onClick={() => setPhotoState(prev => ({ ...prev, error: '' }))}
            className="ml-2 hover:bg-white/20 rounded-xl p-1 transition-colors"
          >
            <Icons.X />
          </button>
        </div>
      </div>
    )}
  </>
);

export const AssetFormModal = ({ 
  showAssetForm, 
  setShowAssetForm, 
  editingAsset, 
  setEditingAsset, 
  assetForm, 
  setAssetForm, 
  handleSaveAsset, 
  resetAssetForm, 
  isLoading, 
  categories, 
  statuses, 
  floors, 
  getRoomsForFloor, 
  openPhotoOptions, 
  removePhotoFromForm,
  Icons 
}) => {
  if (!showAssetForm) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900/80 via-purple-900/80 to-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl w-full max-w-6xl max-h-[95vh] overflow-y-auto shadow-2xl border border-white/20">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-purple-800 to-gray-900 bg-clip-text text-transparent">
                {editingAsset ? '✏️ Editar Ativo' : '➕ Novo Ativo'}
              </h3>
              <p className="text-gray-600 mt-2 font-medium">
                {editingAsset ? 'Atualize as informações do ativo' : 'Cadastre um novo ativo no sistema'}
              </p>
            </div>
            <button
              onClick={() => {
                setShowAssetForm(false);
                setEditingAsset(null);
                resetAssetForm();
              }}
              className="p-3 hover:bg-gray-100 rounded-2xl transition-colors"
            >
              <Icons.X />
            </button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Nome do Ativo *</label>
                <input
                  type="text"
                  value={assetForm.name}
                  onChange={(e) => setAssetForm({...assetForm, name: e.target.value})}
                  className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-medium"
                  placeholder="Ex: Notebook Dell Inspiron 15"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Código *</label>
                <input
                  type="text"
                  value={assetForm.code}
                  onChange={(e) => setAssetForm({...assetForm, code: e.target.value})}
                  className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-mono"
                  placeholder="Ex: NB-001"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Categoria</label>
                <select
                  value={assetForm.category}
                  onChange={(e) => setAssetForm({...assetForm, category: e.target.value})}
                  className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-medium"
                >
                  <option value="">🏷️ Selecione uma categoria</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Status</label>
                <select
                  value={assetForm.status}
                  onChange={(e) => setAssetForm({...assetForm, status: e.target.value})}
                  className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-medium"
                >
                  {statuses.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Andar *</label>
                <select
                  value={assetForm.floor_id}
                  onChange={(e) => setAssetForm({...assetForm, floor_id: e.target.value, room_id: ''})}
                  className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-medium"
                >
                  <option value="">🏢 Selecione um andar</option>
                  {floors.map(floor => (
                    <option key={floor.id} value={floor.id}>{floor.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Sala</label>
                <select
                  value={assetForm.room_id}
                  onChange={(e) => setAssetForm({...assetForm, room_id: e.target.value})}
                  className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-medium"
                  disabled={!assetForm.floor_id}
                >
                  <option value="">🚪 Selecione uma sala (opcional)</option>
                  {getRoomsForFloor(assetForm.floor_id).map(room => (
                    <option key={room.id} value={room.id}>{room.name}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="space-y-6">
              {/* SEÇÃO DE FOTO */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-4">📷 Foto do Ativo</label>
                <div className="space-y-4">
                  {assetForm.photo ? (
                    <div className="relative">
                      <div className="w-full h-64 bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl overflow-hidden border-4 border-white shadow-xl">
                        <img 
                          src={assetForm.photo} 
                          alt="Foto do ativo" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex space-x-3 mt-4">
                        <button
                          type="button"
                          onClick={openPhotoOptions}
                          className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-4 py-4 rounded-2xl flex items-center justify-center space-x-3 text-sm font-bold transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                          <Icons.Camera />
                          <span>📷 Alterar Foto</span>
                        </button>
                        <button
                          type="button"
                          onClick={removePhotoFromForm}
                          className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-4 py-4 rounded-2xl flex items-center justify-center transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                          <Icons.Trash2 />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      onClick={openPhotoOptions}
                      className="w-full h-64 border-4 border-dashed border-purple-300 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-all duration-200 bg-gradient-to-br from-purple-50/50 via-blue-50/50 to-cyan-50/50 backdrop-blur-sm group"
                    >
                      <div className="text-center p-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-lg">
                          <Icons.Camera />
                        </div>
                        <p className="text-gray-700 font-bold text-lg mb-2">📷 Clique para adicionar foto</p>
                        <p className="text-gray-600 font-medium mb-4">
                          Tire uma foto ou escolha da galeria
                        </p>
                        <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 rounded-2xl text-sm font-bold border border-purple-200">
                          <Icons.Sparkles />
                          <span className="ml-2">Recomendado</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={assetForm.value}
                  onChange={(e) => setAssetForm({...assetForm, value: e.target.value})}
                  className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-medium"
                  placeholder="Ex: 2500.00"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Fornecedor</label>
                <input
                  type="text"
                  value={assetForm.supplier}
                  onChange={(e) => setAssetForm({...assetForm, supplier: e.target.value})}
                  className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-medium"
                  placeholder="Ex: Dell Brasil"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Número de Série</label>
                <input
                  type="text"
                  value={assetForm.serial_number}
                  onChange={(e) => setAssetForm({...assetForm, serial_number: e.target.value})}
                  className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-mono"
                  placeholder="Ex: DL24001"
                />
              </div>
            </div>
          </div>
          
          <div className="mt-8">
            <label className="block text-sm font-bold text-gray-700 mb-3">Descrição</label>
            <textarea
              value={assetForm.description}
              onChange={(e) => setAssetForm({...assetForm, description: e.target.value})}
              rows={4}
              className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-medium resize-none"
              placeholder="Descrição detalhada do ativo..."
            />
          </div>
          
          <div className="flex justify-end space-x-4 mt-10 pt-6 border-t border-gray-200">
            <button
              onClick={() => {
                setShowAssetForm(false);
                setEditingAsset(null);
                resetAssetForm();
              }}
              className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-2xl hover:bg-gray-50 transition-all font-bold"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveAsset}
              disabled={isLoading}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-400 text-white rounded-2xl transition-all font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Salvando...</span>
                </div>
              ) : (
                editingAsset ? '✅ Atualizar Ativo' : '💾 Salvar Ativo'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const RoomFormModal = ({ 
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
                {editingRoom ? '✏️ Editar Sala' : '🏢 Nova Sala'}
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
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-400 text-white rounded-2xl transition-all font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
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

export const AssetDetailModal = ({ 
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