<script lang="ts">
  import type { Collection, CollectionType, Site } from '@/types/formatter';
  import {
    createSite,
    downloadMarkdown,
    exportToMarkdown,
    extractFromData,
    extractFromUrl,
  } from '@/lib/formatterUtils';
  import {
    addSiteToCollection,
    createCollection,
    deleteCollection,
    getCollections,
    removeSiteFromCollection,
  } from '@/lib/formatterStorage';
  import { onMount } from 'svelte';

  // State
  let collections = $state<Collection[]>([]);
  let inputUrl = $state('');
  let inputData = $state('');
  let inputType = $state<CollectionType>('recipe');
  let selectedCollectionId = $state<string | null>(null);
  let selectedSiteId = $state<string | null>(null);
  let extractedSite = $state<Site | null>(null);
  let newCollectionName = $state('');
  let newCollectionType = $state<CollectionType>('recipe');
  let showCreateCollection = $state(false);
  let isLoading = $state(false);
  let error = $state('');

  // Views: 'input' | 'collection-list' | 'collection-detail' | 'site-detail'
  let currentView = $state<'input' | 'collection-list' | 'collection-detail' | 'site-detail'>(
    'input'
  );

  // Derived
  const selectedCollection = $derived(
    collections.find((c) => c.id === selectedCollectionId) || null
  );
  const selectedSite = $derived(
    selectedCollection?.sites.find((s) => s.id === selectedSiteId) || null
  );

  // Load collections on mount
  onMount(async () => {
    collections = await getCollections();
  });

  // Handlers
  const handleExtractFromUrl = async () => {
    if (!inputUrl.trim()) {
      error = 'Please enter a URL';
      return;
    }

    isLoading = true;
    error = '';

    try {
      const extracted = await extractFromUrl({ url: inputUrl, type: inputType });
      extractedSite = createSite(extracted, inputType);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to extract from URL';
    } finally {
      isLoading = false;
    }
  };

  const handleExtractFromData = async () => {
    if (!inputData.trim()) {
      error = 'Please paste some data';
      return;
    }

    isLoading = true;
    error = '';

    try {
      const extracted = await extractFromData({ data: inputData, type: inputType });
      extractedSite = createSite(extracted, inputType);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to extract from data';
    } finally {
      isLoading = false;
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) {
      error = 'Please enter a collection name';
      return;
    }

    error = '';
    await createCollection(newCollectionName, newCollectionType);
    collections = await getCollections();
    newCollectionName = '';
    showCreateCollection = false;
  };

  const handleAddToCollection = async (collectionId: string) => {
    if (!extractedSite) return;

    await addSiteToCollection(collectionId, extractedSite);
    collections = await getCollections();
    extractedSite = null;
    inputUrl = '';
    inputData = '';
  };

  const handleDeleteCollection = async (id: string) => {
    if (confirm('Are you sure you want to delete this collection?')) {
      await deleteCollection(id);
      collections = await getCollections();
      if (selectedCollectionId === id) {
        selectedCollectionId = null;
        currentView = 'collection-list';
      }
    }
  };

  const handleRemoveSite = async (collectionId: string, siteId: string) => {
    if (confirm('Remove this site from the collection?')) {
      await removeSiteFromCollection(collectionId, siteId);
      collections = await getCollections();
      if (selectedSiteId === siteId) {
        selectedSiteId = null;
        currentView = 'collection-detail';
      }
    }
  };

  const handleExportCollection = (collection: Collection) => {
    const output = exportToMarkdown({ collection });
    downloadMarkdown(output);
  };

  const handleExportSite = (site: Site) => {
    const tempCollection: Collection = {
      id: 'temp',
      name: site.title,
      type: site.type,
      sites: [site],
      createdAt: site.addedAt,
      updatedAt: site.addedAt,
    };
    const output = exportToMarkdown({ collection: tempCollection });
    downloadMarkdown(output);
  };

  const handleViewCollection = (id: string) => {
    selectedCollectionId = id;
    currentView = 'collection-detail';
  };

  const handleViewSite = (siteId: string) => {
    selectedSiteId = siteId;
    currentView = 'site-detail';
  };

  const handleBackToCollections = () => {
    selectedCollectionId = null;
    selectedSiteId = null;
    currentView = 'collection-list';
  };

  const handleBackToCollection = () => {
    selectedSiteId = null;
    currentView = 'collection-detail';
  };
</script>

<div class="page">
  <header class="header">
    <h1>Helix Formatter</h1>
    <p class="subtitle">Extract, organize, and export recipes and images</p>
  </header>

  <!-- Navigation -->
  <nav class="nav">
    <button onclick={() => (currentView = 'input')} class:active={currentView === 'input'}>
      Extract
    </button>
    <button
      onclick={() => (currentView = 'collection-list')}
      class:active={currentView === 'collection-list' ||
        currentView === 'collection-detail' ||
        currentView === 'site-detail'}
    >
      Collections ({collections.length})
    </button>
  </nav>

  <!-- Error Message -->
  {#if error}
    <div class="error">{error}</div>
  {/if}

  <!-- Input View -->
  {#if currentView === 'input'}
    <div class="input-view">
      <section class="section">
        <h2>Extract Site Data</h2>

        <div class="form-group">
          <label for="type">Collection Type</label>
          <select id="type" bind:value={inputType}>
            <option value="recipe">Recipe</option>
            <option value="image">Image</option>
          </select>
        </div>

        <div class="form-group">
          <label for="url">From URL</label>
          <div class="input-row">
            <input
              id="url"
              type="url"
              placeholder="https://example.com/recipe"
              bind:value={inputUrl}
              disabled={isLoading}
            />
            <button onclick={handleExtractFromUrl} disabled={isLoading}>
              {isLoading ? 'Extracting...' : 'Extract'}
            </button>
          </div>
        </div>

        <div class="divider">OR</div>

        <div class="form-group">
          <label for="data">Paste Data</label>
          <textarea
            id="data"
            rows="10"
            placeholder={inputType === 'recipe'
              ? 'Paste recipe data here...'
              : 'Paste image data here...'}
            bind:value={inputData}
          ></textarea>
          <button onclick={handleExtractFromData} disabled={isLoading}>
            {isLoading ? 'Extracting...' : 'Extract from Data'}
          </button>
        </div>
      </section>

      {#if extractedSite}
        <section class="section">
          <h2>Extracted Site Preview</h2>
          <div class="site-preview">
            <h3>{extractedSite.title}</h3>
            {#if extractedSite.url}
              <p class="url">{extractedSite.url}</p>
            {/if}

            {#if extractedSite.type === 'recipe'}
              <div class="recipe-preview">
                {#if extractedSite.data.servings}
                  <p><strong>Servings:</strong> {extractedSite.data.servings}</p>
                {/if}
                {#if extractedSite.data.ingredients.length > 0}
                  <h4>Ingredients ({extractedSite.data.ingredients.length})</h4>
                  <ul>
                    {#each extractedSite.data.ingredients.slice(0, 5) as ingredient}
                      <li>
                        {ingredient.amount || ''}
                        {ingredient.unit || ''}
                        {ingredient.name}
                      </li>
                    {/each}
                    {#if extractedSite.data.ingredients.length > 5}
                      <li>... and {extractedSite.data.ingredients.length - 5} more</li>
                    {/if}
                  </ul>
                {/if}
              </div>
            {:else if extractedSite.type === 'image'}
              <div class="image-preview">
                <p><strong>Images:</strong> {extractedSite.data.images.length}</p>
              </div>
            {/if}
          </div>

          <div class="add-to-collection">
            <h3>Add to Collection</h3>
            {#if collections.length === 0}
              <p>No collections yet. Create one first!</p>
            {:else}
              <div class="collection-buttons">
                {#each collections as collection}
                  <button
                    class="collection-btn"
                    onclick={() => handleAddToCollection(collection.id)}
                    disabled={collection.type !== extractedSite.type}
                  >
                    {collection.name} ({collection.type})
                  </button>
                {/each}
              </div>
            {/if}

            <button
              class="secondary"
              onclick={() => (showCreateCollection = !showCreateCollection)}
            >
              {showCreateCollection ? 'Cancel' : 'Create New Collection'}
            </button>

            {#if showCreateCollection}
              <div class="create-collection-form">
                <input type="text" placeholder="Collection name" bind:value={newCollectionName} />
                <select bind:value={newCollectionType}>
                  <option value="recipe">Recipe</option>
                  <option value="image">Image</option>
                </select>
                <button onclick={handleCreateCollection}>Create</button>
              </div>
            {/if}
          </div>
        </section>
      {/if}
    </div>
  {/if}

  <!-- Collection List View -->
  {#if currentView === 'collection-list'}
    <div class="collection-list-view">
      <div class="section-header">
        <h2>Collections</h2>
        <button class="secondary" onclick={() => (showCreateCollection = !showCreateCollection)}>
          Create Collection
        </button>
      </div>

      {#if showCreateCollection}
        <div class="create-collection-form section">
          <input type="text" placeholder="Collection name" bind:value={newCollectionName} />
          <select bind:value={newCollectionType}>
            <option value="recipe">Recipe</option>
            <option value="image">Image</option>
          </select>
          <button onclick={handleCreateCollection}>Create</button>
          <button class="secondary" onclick={() => (showCreateCollection = false)}>Cancel</button>
        </div>
      {/if}

      {#if collections.length === 0}
        <div class="empty-state">
          <p>No collections yet. Extract some sites first!</p>
        </div>
      {:else}
        <div class="collections-grid">
          {#each collections as collection}
            <div class="collection-card">
              <div class="collection-header">
                <h3>{collection.name}</h3>
                <span class="badge">{collection.type}</span>
              </div>
              <p class="collection-info">
                {collection.sites.length} site{collection.sites.length !== 1 ? 's' : ''}
              </p>
              <p class="collection-date">
                Created: {new Date(collection.createdAt).toLocaleDateString()}
              </p>
              <div class="collection-actions">
                <button onclick={() => handleViewCollection(collection.id)}>View</button>
                <button class="secondary" onclick={() => handleExportCollection(collection)}
                  >Export</button
                >
                <button class="danger" onclick={() => handleDeleteCollection(collection.id)}
                  >Delete</button
                >
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Collection Detail View -->
  {#if currentView === 'collection-detail' && selectedCollection}
    <div class="collection-detail-view">
      <button class="back-btn" onclick={handleBackToCollections}>← Back to Collections</button>

      <div class="section-header">
        <div>
          <h2>{selectedCollection.name}</h2>
          <span class="badge">{selectedCollection.type}</span>
        </div>
        <button class="secondary" onclick={() => handleExportCollection(selectedCollection)}>
          Export as Markdown
        </button>
      </div>

      {#if selectedCollection.sites.length === 0}
        <div class="empty-state">
          <p>No sites in this collection yet.</p>
        </div>
      {:else}
        <div class="sites-grid">
          {#each selectedCollection.sites as site}
            <div class="site-card">
              <h3>{site.title}</h3>
              {#if site.url}
                <p class="url">{site.url}</p>
              {/if}
              <p class="site-date">Added: {new Date(site.addedAt).toLocaleDateString()}</p>
              <div class="site-actions">
                <button onclick={() => handleViewSite(site.id)}>View Details</button>
                <button
                  class="danger"
                  onclick={() => handleRemoveSite(selectedCollection.id, site.id)}>Remove</button
                >
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Site Detail View -->
  {#if currentView === 'site-detail' && selectedSite && selectedCollection}
    <div class="site-detail-view">
      <button class="back-btn" onclick={handleBackToCollection}
        >← Back to {selectedCollection.name}</button
      >

      <div class="section">
        <div class="section-header">
          <h2>{selectedSite.title}</h2>
          <button class="secondary" onclick={() => handleExportSite(selectedSite)}>
            Export as Markdown
          </button>
        </div>
        {#if selectedSite.url}
          <a href={selectedSite.url} target="_blank" class="external-link">{selectedSite.url} ↗</a>
        {/if}

        {#if selectedSite.type === 'recipe'}
          <div class="recipe-detail">
            {#if selectedSite.data.servings}
              <div class="detail-row">
                <strong>Servings:</strong>
                {selectedSite.data.servings}
              </div>
            {/if}

            {#if selectedSite.data.ingredients.length > 0}
              <h3>Ingredients</h3>
              <ul class="ingredients-list">
                {#each selectedSite.data.ingredients as ingredient}
                  <li>
                    {ingredient.amount || ''}
                    {ingredient.unit || ''}
                    {ingredient.name}
                  </li>
                {/each}
              </ul>
            {/if}

            {#if selectedSite.data.main.length > 0}
              <h3>Main Steps</h3>
              <ol class="steps-list">
                {#each selectedSite.data.main as step}
                  <li>{step}</li>
                {/each}
              </ol>
            {/if}

            {#if selectedSite.data.optional && selectedSite.data.optional.length > 0}
              <h3>Optional Steps</h3>
              <ol class="steps-list">
                {#each selectedSite.data.optional as step}
                  <li>{step}</li>
                {/each}
              </ol>
            {/if}
          </div>
        {:else if selectedSite.type === 'image'}
          <div class="image-detail">
            <h3>Images ({selectedSite.data.images.length})</h3>
            <div class="image-gallery">
              {#each selectedSite.data.images as image}
                <div class="gallery-item">
                  <img src={image.url} alt={image.alt || image.title} />
                  <div class="gallery-info">
                    <p class="image-title">{image.title}</p>
                    {#if image.alt}
                      <p class="image-alt">{image.alt}</p>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .page {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1rem;
  }

  .header {
    text-align: center;
    margin-bottom: 2rem;
    padding: 2rem 0;
    border-bottom: 2px solid #e5e7eb;
  }

  .header h1 {
    font-size: 2.5rem;
    color: #1f2937;
    margin-bottom: 0.5rem;
  }

  .subtitle {
    color: #6b7280;
    font-size: 1.125rem;
  }

  .nav {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 0.5rem;
  }

  .nav button {
    padding: 0.5rem 1rem;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 0.375rem;
    transition: all 0.2s;
    font-size: 1rem;
  }

  .nav button:hover {
    background: #f3f4f6;
  }

  .nav button.active {
    background: #3b82f6;
    color: white;
  }

  .error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #991b1b;
    padding: 0.75rem 1rem;
    border-radius: 0.375rem;
    margin-bottom: 1rem;
  }

  .section {
    background: white;
    border-radius: 0.5rem;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  }

  .section h2 {
    margin-bottom: 1rem;
    color: #1f2937;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #374151;
  }

  .form-group input,
  .form-group textarea,
  .form-group select {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 1rem;
  }

  .form-group textarea {
    font-family: inherit;
    resize: vertical;
  }

  .input-row {
    display: flex;
    gap: 0.5rem;
  }

  .input-row input {
    flex: 1;
  }

  .divider {
    text-align: center;
    margin: 1.5rem 0;
    color: #9ca3af;
    font-weight: 500;
  }

  button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 0.375rem;
    background: #3b82f6;
    color: white;
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.2s;
  }

  button:hover:not(:disabled) {
    background: #2563eb;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  button.secondary {
    background: #e5e7eb;
    color: #374151;
  }

  button.secondary:hover:not(:disabled) {
    background: #d1d5db;
  }

  button.danger {
    background: #ef4444;
  }

  button.danger:hover:not(:disabled) {
    background: #dc2626;
  }

  .site-preview {
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    padding: 1rem;
    margin-top: 1rem;
  }

  .site-preview h3 {
    margin-bottom: 0.5rem;
    color: #1f2937;
  }

  .url {
    color: #6b7280;
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  .recipe-preview ul,
  .ingredients-list {
    list-style-type: disc;
    margin-left: 1.5rem;
    margin-top: 0.5rem;
  }

  .steps-list {
    list-style-type: decimal;
    margin-left: 1.5rem;
    margin-top: 0.5rem;
  }

  .add-to-collection {
    margin-top: 1.5rem;
  }

  .add-to-collection h3 {
    margin-bottom: 0.75rem;
  }

  .collection-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .collection-btn {
    background: #10b981;
  }

  .collection-btn:hover:not(:disabled) {
    background: #059669;
  }

  .create-collection-form {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .collections-grid,
  .sites-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
  }

  .collection-card,
  .site-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 1rem;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  }

  .collection-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .collection-header h3 {
    margin: 0;
    font-size: 1.125rem;
  }

  .badge {
    background: #dbeafe;
    color: #1e40af;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .collection-info,
  .site-date {
    color: #6b7280;
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
  }

  .collection-date {
    color: #9ca3af;
    font-size: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .collection-actions,
  .site-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .collection-actions button,
  .site-actions button {
    flex: 1;
    font-size: 0.875rem;
    padding: 0.375rem 0.75rem;
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    border: 2px dashed #e5e7eb;
    border-radius: 0.5rem;
    color: #9ca3af;
  }

  .back-btn {
    margin-bottom: 1rem;
    background: #e5e7eb;
    color: #374151;
  }

  .back-btn:hover {
    background: #d1d5db;
  }

  .external-link {
    display: block;
    color: #3b82f6;
    text-decoration: none;
    margin-bottom: 1rem;
  }

  .external-link:hover {
    text-decoration: underline;
  }

  .detail-row {
    margin-bottom: 1rem;
  }

  .recipe-detail h3,
  .image-detail h3 {
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
    font-size: 1.25rem;
    color: #1f2937;
  }

  .image-gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1rem;
  }

  .gallery-item {
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    padding: 0.5rem;
  }

  .gallery-item img {
    width: 100%;
    border-radius: 0.25rem;
    margin-bottom: 0.5rem;
  }

  .image-title {
    font-weight: 500;
    margin-bottom: 0.25rem;
  }

  .image-alt {
    color: #6b7280;
    font-size: 0.875rem;
  }
</style>

