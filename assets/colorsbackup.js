const chartData = {
  labels: Object.keys(data1),
  datasets: [
    {
      data: Object.values(data1),
      backgroundColor: [
        "#9bd8f9",
        "#5CBABC",
        "#a1dbbc",
        "#fdd47b",
        "#fabddc",
        "#ebbfdc",
        "#c2a1e9",
        // Add more colors as needed
      ],
      hoverBackgroundColor: "#0099ff",
    },
  ],
};