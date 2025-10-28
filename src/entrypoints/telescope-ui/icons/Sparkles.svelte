<script lang="ts">
</script>
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M12 3v18"></path>
  <path d="m19 8-7 7-7-7"></path>
  <path d="m8 12 2 2 4-4"></path>
  <path
    d="m9.5 9.5 1.5-1.5 1.5 1.5M15 15l-3 3-3-3M12 8V3m0 13v6m6-15l-1.5 1.5L15 9.5M9 9.5 7.5 8 6 9.5M15 14.5l1.5 1.5 1.5-1.5M9 14.5 7.5 16 6 14.5"
  ></path>
</svg>

<style>
  svg {
    animation: sparkle 2s ease-in-out infinite;
  }

  @keyframes sparkle {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.7;
      transform: scale(1.1);
    }
  }
</style>
