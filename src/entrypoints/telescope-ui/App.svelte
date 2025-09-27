<script lang="ts">
</script>

<div class="container-helix">
  <input type="text" placeholder="Find or Ask" />
</div>

<style>
  .container-helix {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 80px;
    width: 250px;
    background-color: #000;
    border-radius: 10px;
    margin: 10px;
    box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.5);
    z-index: 1000;
  }

  input {
    background-color: transparent;
    color: white;
    border: none;
    outline: none;
    font-size: 16px;
    font-weight: 600;
    border-radius: 5px;
    margin-bottom: 10px;
  }
  input::placeholder {
    color: white;
    opacity: 1;
  }
</style>
